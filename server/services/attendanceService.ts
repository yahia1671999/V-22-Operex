import { db } from '../../src/db/index';
import * as schema from '../../src/db/schema';
import { eq, and, or, sql } from 'drizzle-orm';
import crypto from 'crypto';

export interface NetworkValidationRequest {
  employeeId: string;
  publicIp: string;
  localIp?: string;
  ssid?: string;
  gatewayIp?: string;
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  workMode?: string;
  isRemote?: boolean;
}

export interface NetworkValidationResult {
  isAllowed: boolean;
  matchedNetworkId?: string;
  failureReason?: string;
  details?: any;
  matchedRules?: string[];
}

export class AttendanceNetworkValidationService {
  static async validate(request: NetworkValidationRequest): Promise<NetworkValidationResult> {
    try {
      // 1. Fetch the employee and their branch/dept
      let employee = (await db.select().from(schema.employees).where(
        or(
          eq(schema.employees.id, request.employeeId),
          eq(schema.employees.employeeId, request.employeeId),
          sql`lower(${schema.employees.email}) = lower(${request.employeeId})`
        )
      ))[0];

      if (!employee) {
        return { isAllowed: false, failureReason: "لم يتم العثور على سجل الموظف" };
      }

      // 1b. Check if employee's Work Mode is Remotely Work or requested as remote
      const isRemoteWork = 
        request.isRemote === true ||
        request.workMode === 'Remotely Work' ||
        employee.workMode === 'Remotely Work' ||
        employee.workMode === 'Remote' ||
        employee.workMode === 'Work From Home' ||
        (employee as any).workLocation === 'Remote' ||
        (employee as any).workLocation === 'عمل عن بعد' ||
        (employee as any).workType === 'Remote' ||
        (employee as any).jobType === 'Remote';

      if (isRemoteWork) {
        return {
          isAllowed: true,
          matchedNetworkId: 'remotely_work',
          matchedRules: ['Remotely Work Mode'],
          details: { networkName: 'العمل عن بُعد (Remotely Work)' }
        };
      }

      // 1c. Check if employee has an approved Work From Home request for today
      const todayStr = new Date().toISOString().split('T')[0];
      const approvedWfh = await db.select().from(schema.leaveRequests).where(
        and(
          eq(schema.leaveRequests.employeeId, employee.id),
          eq(schema.leaveRequests.type, 'WorkFromHome'),
          eq(schema.leaveRequests.status, 'Approved'),
          sql`${schema.leaveRequests.startDate} <= ${todayStr}`,
          sql`${schema.leaveRequests.endDate} >= ${todayStr}`
        )
      );

      if (approvedWfh && approvedWfh.length > 0) {
        return {
          isAllowed: true,
          matchedNetworkId: 'wfh_request',
          matchedRules: ['Approved Work From Home Request'],
          details: { networkName: 'إذن عمل من المنزل (WFH)' }
        };
      }

      // 2. Fetch active networks
      const activeNetworks = await db.select().from(schema.wifiAttendanceNetworks).where(eq(schema.wifiAttendanceNetworks.isActive, true));

      if (activeNetworks.length === 0) {
        return { isAllowed: false, failureReason: "لم يتم تعريف شبكات أو مواقع معتمدة لتسجيل الحضور في النظام." };
      }

      // 3. Filter networks applicable to this employee
      const applicableNetworks = activeNetworks.filter(net => {
        // If not limited to Branch, it applies to all
        if (!net.appliesToType || net.appliesToType === 'All') return true;

        // Check Branch
        if (net.appliesToType === 'Branch' && net.branchId === employee.branchId) return true;
        
        // Specific checks
        if (net.appliesToType === 'Specific' && net.appliesToValue) {
           try {
             const values = JSON.parse(net.appliesToValue);
             if (Array.isArray(values) && (values.includes(request.employeeId) || values.includes(employee.departmentId || ''))) return true;
           } catch(e) {}
        }
        
        return false;
      });

      if (applicableNetworks.length === 0) {
        return { 
          isAllowed: false, 
          failureReason: `فرعك الحالي غير مخول باستخدام أي من الشبكات أو المواقع المحددة في النظام.` 
        };
      }

      // 4. Validate against each network based on its verification mode
      let lastFailure = "";
      for (const net of applicableNetworks) {
        let matches = false;
        const mode = net.verificationMode || 'Flexible Mode';

        // 1. Public IP Match
        const publicIpMatch = !!(request.publicIp && net.publicIp && request.publicIp === net.publicIp);

        // 2. Gateway Match
        const gatewayMatch = !!(request.gatewayIp && net.gatewayIp && request.gatewayIp === net.gatewayIp);

        // 3. IP Range Match (CIDR or Range)
        let ipRangeMatch = false;
        if (request.localIp) {
          if (net.ipRangeCidr) {
            ipRangeMatch = this.isIpInCidr(request.localIp, net.ipRangeCidr);
          } else if (net.allowedIpStart && net.allowedIpEnd) {
            ipRangeMatch = this.isIpInRange(request.localIp, net.allowedIpStart, net.allowedIpEnd);
          }
        }

        // 4. GPS Match (Haversine distance <= allowedRadiusMeters)
        let gpsMatch = false;
        let gpsDistance: number | null = null;
        if (request.latitude !== undefined && request.longitude !== undefined && net.latitude && net.longitude) {
          gpsDistance = this.getDistanceMeters(request.latitude, request.longitude, Number(net.latitude), Number(net.longitude));
          gpsMatch = gpsDistance <= (net.allowedRadiusMeters || 100);
        }

        const matchesList: string[] = [];
        if (publicIpMatch) matchesList.push('Public IP');
        if (gatewayMatch) matchesList.push('Gateway');
        if (ipRangeMatch) matchesList.push('IP Range');
        if (gpsMatch) matchesList.push('GPS');

        const matchesCount = matchesList.length;

        // Resolve status of matches based on Verification Mode
        let totalConfiguredCriteria = 0;
        if (net.publicIp) totalConfiguredCriteria++;
        if (net.gatewayIp) totalConfiguredCriteria++;
        if (net.ipRangeCidr || (net.allowedIpStart && net.allowedIpEnd)) totalConfiguredCriteria++;
        if (net.latitude && net.longitude) totalConfiguredCriteria++;

        if (mode === 'Strict Mode') {
          // Strict Mode: must match CIDR range + gateway + gps
          matches = ipRangeMatch && gatewayMatch && gpsMatch;
        } else if (mode === 'Flexible Mode') {
          // Flexible Mode: any N matches
          let reqMatches = net.minimumRequiredMatches || 2;
          if (totalConfiguredCriteria > 0 && reqMatches > totalConfiguredCriteria) {
            reqMatches = totalConfiguredCriteria;
          }
          matches = matchesCount >= reqMatches;
        } else if (mode === 'Network Only') {
          // Network Only: any network match counts
          matches = gatewayMatch || ipRangeMatch || publicIpMatch;
        } else if (mode === 'GPS Only') {
          matches = gpsMatch;
        } else if (mode === 'Public IP Only') {
          matches = publicIpMatch;
        } else {
          // Default to Flexible (any 2 matches)
          let reqMatches = net.minimumRequiredMatches || 2;
          if (totalConfiguredCriteria > 0 && reqMatches > totalConfiguredCriteria) {
            reqMatches = totalConfiguredCriteria;
          }
          matches = matchesCount >= reqMatches;
        }

        const details = {
          mode,
          networkName: net.networkName,
          publicIp: publicIpMatch ? 'Passed' : 'Failed',
          gateway: gatewayMatch ? 'Passed' : 'Failed',
          ipRange: ipRangeMatch ? 'Passed' : 'Failed',
          gps: gpsMatch ? 'Passed' : 'Failed',
          gpsDistance,
          requiredMatches: (mode === 'Flexible Mode' || !net.verificationMode) ? (net.minimumRequiredMatches || 2) : undefined,
          actualMatches: matchesCount,
          currentIp: request.publicIp,
          gatewayIp: request.gatewayIp,
          localIp: request.localIp,
          gpsCoords: gpsDistance !== null ? `${request.latitude},${request.longitude}` : 'غير متوفر'
        };

        if (matches) {
          return { 
            isAllowed: true, 
            matchedNetworkId: net.id, 
            matchedRules: matchesList,
            details: { ...details, successMsg: `تم تسجيل الحضور بنجاح من الفرع: ${net.networkName}` }
          };
        } else {
          const modeStrAr = mode === 'Strict Mode' ? 'التحقق الصارم (Strict)' : 
                            mode === 'Flexible Mode' ? 'التحقق المرن (Flexible)' :
                            mode === 'Network Only' ? 'شبكة الاتصال فقط' :
                            mode === 'GPS Only' ? 'الموقع الجغرافي فقط' : 'محدد عنوان السيرفر فقط';

          lastFailure = `فشل التحقق من موقع الحضور:
- Public IP: ${publicIpMatch ? 'Passed' : 'Failed'}
- Gateway: ${gatewayMatch ? 'Passed' : 'Failed'}
- IP Range: ${ipRangeMatch ? 'Passed' : 'Failed'}
- GPS: ${gpsMatch ? 'Passed' : 'Failed'}
وضع التحقق: ${modeStrAr}
عدد المطابقات المطلوبة: ${mode === 'Flexible Mode' ? (net.minimumRequiredMatches || 2) : 'غير مرن'} (المحققة: ${matchesCount})`;
        }
      }

      return { 
        isAllowed: false, 
        failureReason: lastFailure || "فشل التحقق من تواجدك بموقع العمل المعتمد لإجراء البصمة.",
        details: { currentIp: request.publicIp, localIp: request.localIp }
      };

    } catch (error) {
      console.error("Network validation error:", error);
      return { isAllowed: false, failureReason: "حدث خطأ داخلي أثناء التحقق من بصمة الحضور" };
    }
  }

  private static isIpInRange(ip: string, start: string, end: string): boolean {
    try {
      const ipNum = this.ipToNumber(ip);
      const startNum = this.ipToNumber(start);
      const endNum = this.ipToNumber(end);
      return ipNum >= startNum && ipNum <= endNum;
    } catch(e) {
      return false;
    }
  }

  private static isIpInCidr(ip: string, cidr: string): boolean {
    try {
      const [range, bitsStr] = cidr.split('/');
      const bits = parseInt(bitsStr, 10);
      const ipNum = this.ipToNumber(ip);
      const rangeNum = this.ipToNumber(range);
      const mask = bits === 0 ? 0 : (~0 << (32 - bits));
      return (ipNum & mask) === (rangeNum & mask);
    } catch (e) {
      return false;
    }
  }

  private static ipToNumber(ip: string): number {
    return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
  }

  private static getDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // Earth radius in meters
    const phi1 = lat1 * Math.PI/180;
    const phi2 = lat2 * Math.PI/180;
    const deltaPhi = (lat2 - lat1) * Math.PI/180;
    const deltaLambda = (lon2 - lon1) * Math.PI/180;

    const a = Math.sin(deltaPhi/2) * Math.sin(deltaPhi/2) +
              Math.cos(phi1) * Math.cos(phi2) *
              Math.sin(deltaLambda/2) * Math.sin(deltaLambda/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c; // in meters
  }

  static async logAttempt(data: any) {
    try {
      let matchedNetworkId = data.matchedNetworkId;
      if (matchedNetworkId && typeof matchedNetworkId === 'string' && matchedNetworkId.trim() !== '') {
        const netExists = await db.select({ id: schema.wifiAttendanceNetworks.id })
          .from(schema.wifiAttendanceNetworks)
          .where(eq(schema.wifiAttendanceNetworks.id, matchedNetworkId));
        if (netExists.length === 0) {
          matchedNetworkId = null;
        }
      } else {
        matchedNetworkId = null;
      }

      let employeeId = data.employeeId;
      if (!employeeId || typeof employeeId !== 'string') {
        console.warn("logAttempt skipped: missing employeeId");
        return;
      }

      const empExists = await db.select({ id: schema.employees.id })
        .from(schema.employees)
        .where(eq(schema.employees.id, employeeId));

      if (empExists.length === 0) {
        console.warn(`logAttempt skipped: employeeId ${employeeId} not found in employees table`);
        return;
      }

      await db.insert(schema.attendanceLogs).values({
        id: crypto.randomUUID(),
        ...data,
        employeeId,
        matchedNetworkId,
      });
    } catch (e) {
      console.error("Failed to log attendance attempt:", e);
    }
  }
}
