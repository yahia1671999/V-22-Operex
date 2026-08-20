import * as dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema';

dotenv.config({ override: true });

const dbPath = process.env.DATABASE_PATH || './server/database/sqlite.db';
const dbDir = path.dirname(dbPath);

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

export const sqlite = new Database(dbPath);

// SQLite Optimizations
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('busy_timeout = 5000');
sqlite.pragma('foreign_keys = ON');
sqlite.pragma('synchronous = NORMAL');

/**
 * Comprehensive Database Schema Synchronizer
 * Automatically creates any missing tables and adds any missing columns across all tables.
 */
export function syncDatabaseSchema(dbInstance: Database.Database) {
  console.log('🔄 [DB SYNC] Running comprehensive schema synchronization...');

  // Schema Table Definitions
  const tableSchemas: Record<string, { createSql: string; columns: Record<string, string> }> = {
    app_users: {
      createSql: `
        CREATE TABLE IF NOT EXISTS app_users (
          id TEXT PRIMARY KEY,
          email TEXT NOT NULL UNIQUE,
          name TEXT NOT NULL,
          role TEXT NOT NULL,
          password TEXT,
          status TEXT NOT NULL DEFAULT 'Active',
          permissions TEXT,
          photo_url TEXT,
          lock_password TEXT,
          employee_id TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
      `,
      columns: {
        id: 'TEXT PRIMARY KEY',
        email: 'TEXT NOT NULL',
        name: 'TEXT NOT NULL',
        role: 'TEXT NOT NULL',
        password: 'TEXT',
        status: "TEXT NOT NULL DEFAULT 'Active'",
        permissions: 'TEXT',
        photo_url: 'TEXT',
        lock_password: 'TEXT',
        employee_id: 'TEXT',
        created_at: 'TEXT DEFAULT CURRENT_TIMESTAMP'
      }
    },
    admin_departments: {
      createSql: `
        CREATE TABLE IF NOT EXISTS admin_departments (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT,
          manager_id TEXT,
          parent_dept_id TEXT
        );
      `,
      columns: {
        id: 'TEXT PRIMARY KEY',
        name: 'TEXT NOT NULL',
        description: 'TEXT',
        manager_id: 'TEXT',
        parent_dept_id: 'TEXT'
      }
    },
    attendance_shifts: {
      createSql: `
        CREATE TABLE IF NOT EXISTS attendance_shifts (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          start_time TEXT NOT NULL,
          end_time TEXT NOT NULL,
          grace_minutes INTEGER DEFAULT 0,
          work_days TEXT
        );
      `,
      columns: {
        id: 'TEXT PRIMARY KEY',
        name: 'TEXT NOT NULL',
        start_time: 'TEXT NOT NULL',
        end_time: 'TEXT NOT NULL',
        grace_minutes: 'INTEGER DEFAULT 0',
        work_days: 'TEXT'
      }
    },
    employees: {
      createSql: `
        CREATE TABLE IF NOT EXISTS employees (
          id TEXT PRIMARY KEY,
          employee_id TEXT NOT NULL UNIQUE,
          name TEXT NOT NULL,
          iqama_number TEXT,
          nationality TEXT,
          job_title TEXT,
          join_date TEXT,
          work_type TEXT,
          bank_account TEXT,
          bank_code TEXT,
          payment_method TEXT,
          basic_salary REAL DEFAULT 0,
          housing_allowance REAL DEFAULT 0,
          transport_allowance REAL DEFAULT 0,
          subsistence_allowance REAL DEFAULT 0,
          other_allowances REAL DEFAULT 0,
          mobile_allowance REAL DEFAULT 0,
          management_allowance REAL DEFAULT 0,
          daily_work_hours INTEGER DEFAULT 8,
          status TEXT DEFAULT 'Active',
          allowances TEXT,
          role TEXT,
          email TEXT,
          shift_id TEXT,
          manager_id TEXT,
          department_id TEXT,
          branch_id TEXT,
          legal_entity TEXT,
          payroll_group TEXT,
          contract_type TEXT,
          end_of_service_date TEXT,
          insurance_profile TEXT,
          tax_profile TEXT,
          leave_plan TEXT,
          sick_leave_plan TEXT DEFAULT '30',
          grade_level TEXT,
          subject_to_si TEXT DEFAULT 'No',
          si_number TEXT,
          subject_to_tax TEXT DEFAULT 'No',
          tax_exempt TEXT DEFAULT 'No',
          active_deductions TEXT,
          exempt_from_appraisal TEXT DEFAULT 'No',
          work_mode TEXT DEFAULT 'Office Work',
          subject_to_attendance TEXT DEFAULT 'Yes',
          attendance_status_effective_date TEXT
        );
      `,
      columns: {
        id: 'TEXT PRIMARY KEY',
        employee_id: 'TEXT NOT NULL',
        name: 'TEXT NOT NULL',
        iqama_number: 'TEXT',
        nationality: 'TEXT',
        job_title: 'TEXT',
        join_date: 'TEXT',
        work_type: 'TEXT',
        bank_account: 'TEXT',
        bank_code: 'TEXT',
        payment_method: 'TEXT',
        basic_salary: 'REAL DEFAULT 0',
        housing_allowance: 'REAL DEFAULT 0',
        transport_allowance: 'REAL DEFAULT 0',
        subsistence_allowance: 'REAL DEFAULT 0',
        other_allowances: 'REAL DEFAULT 0',
        mobile_allowance: 'REAL DEFAULT 0',
        management_allowance: 'REAL DEFAULT 0',
        daily_work_hours: 'INTEGER DEFAULT 8',
        status: "TEXT DEFAULT 'Active'",
        allowances: 'TEXT',
        role: 'TEXT',
        email: 'TEXT',
        shift_id: 'TEXT',
        manager_id: 'TEXT',
        department_id: 'TEXT',
        branch_id: 'TEXT',
        legal_entity: 'TEXT',
        payroll_group: 'TEXT',
        contract_type: 'TEXT',
        end_of_service_date: 'TEXT',
        insurance_profile: 'TEXT',
        tax_profile: 'TEXT',
        leave_plan: 'TEXT',
        sick_leave_plan: "TEXT DEFAULT '30'",
        grade_level: 'TEXT',
        subject_to_si: "TEXT DEFAULT 'No'",
        si_number: 'TEXT',
        subject_to_tax: "TEXT DEFAULT 'No'",
        tax_exempt: "TEXT DEFAULT 'No'",
        active_deductions: 'TEXT',
        exempt_from_appraisal: "TEXT DEFAULT 'No'",
        work_mode: "TEXT DEFAULT 'Office Work'",
        subject_to_attendance: "TEXT DEFAULT 'Yes'",
        attendance_status_effective_date: 'TEXT'
      }
    },
    attendance_records: {
      createSql: `
        CREATE TABLE IF NOT EXISTS attendance_records (
          id TEXT PRIMARY KEY,
          employee_id TEXT NOT NULL,
          timestamp TEXT NOT NULL,
          type TEXT NOT NULL,
          device_id TEXT,
          device_name TEXT,
          manual INTEGER DEFAULT 0,
          note TEXT
        );
      `,
      columns: {
        id: 'TEXT PRIMARY KEY',
        employee_id: 'TEXT NOT NULL',
        timestamp: 'TEXT NOT NULL',
        type: 'TEXT NOT NULL',
        device_id: 'TEXT',
        device_name: 'TEXT',
        manual: 'INTEGER DEFAULT 0',
        note: 'TEXT'
      }
    },
    attendance_devices: {
      createSql: `
        CREATE TABLE IF NOT EXISTS attendance_devices (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          ip_address TEXT,
          port INTEGER,
          last_sync TEXT,
          status TEXT DEFAULT 'Offline'
        );
      `,
      columns: {
        id: 'TEXT PRIMARY KEY',
        name: 'TEXT NOT NULL',
        ip_address: 'TEXT',
        port: 'INTEGER',
        last_sync: 'TEXT',
        status: "TEXT DEFAULT 'Offline'"
      }
    },
    absence_types: {
      createSql: `
        CREATE TABLE IF NOT EXISTS absence_types (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          deduction_ratio REAL DEFAULT 1
        );
      `,
      columns: {
        id: 'TEXT PRIMARY KEY',
        name: 'TEXT NOT NULL',
        deduction_ratio: 'REAL DEFAULT 1'
      }
    },
    absence_records: {
      createSql: `
        CREATE TABLE IF NOT EXISTS absence_records (
          id TEXT PRIMARY KEY,
          employee_id TEXT NOT NULL,
          date TEXT NOT NULL,
          absence_type_id TEXT,
          note TEXT
        );
      `,
      columns: {
        id: 'TEXT PRIMARY KEY',
        employee_id: 'TEXT NOT NULL',
        date: 'TEXT NOT NULL',
        absence_type_id: 'TEXT',
        note: 'TEXT'
      }
    },
    allowance_types: {
      createSql: `
        CREATE TABLE IF NOT EXISTS allowance_types (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL
        );
      `,
      columns: {
        id: 'TEXT PRIMARY KEY',
        name: 'TEXT NOT NULL'
      }
    },
    mission_types: {
      createSql: `
        CREATE TABLE IF NOT EXISTS mission_types (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          allowance_amount REAL,
          allowances TEXT,
          project_ids TEXT
        );
      `,
      columns: {
        id: 'TEXT PRIMARY KEY',
        name: 'TEXT NOT NULL',
        allowance_amount: 'REAL',
        allowances: 'TEXT',
        project_ids: 'TEXT'
      }
    },
    missions: {
      createSql: `
        CREATE TABLE IF NOT EXISTS missions (
          id TEXT PRIMARY KEY,
          employee_id TEXT NOT NULL,
          project_id TEXT,
          start_date TEXT NOT NULL,
          end_date TEXT NOT NULL,
          mission_type_id TEXT,
          status TEXT DEFAULT 'Pending',
          notes TEXT,
          allowances TEXT,
          evaluation TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
      `,
      columns: {
        id: 'TEXT PRIMARY KEY',
        employee_id: 'TEXT NOT NULL',
        project_id: 'TEXT',
        start_date: 'TEXT NOT NULL',
        end_date: 'TEXT NOT NULL',
        mission_type_id: 'TEXT',
        status: "TEXT DEFAULT 'Pending'",
        notes: 'TEXT',
        allowances: 'TEXT',
        evaluation: 'TEXT',
        created_at: 'TEXT DEFAULT CURRENT_TIMESTAMP',
        updated_at: 'TEXT DEFAULT CURRENT_TIMESTAMP'
      }
    },
    projects: {
      createSql: `
        CREATE TABLE IF NOT EXISTS projects (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          parent_project_id TEXT,
          client_name TEXT,
          description TEXT,
          details TEXT,
          project_manager_id TEXT,
          team_leader_id TEXT,
          consultant_tl_id TEXT,
          developer_tl_id TEXT,
          phases TEXT,
          start_date TEXT,
          end_date TEXT,
          status TEXT DEFAULT 'Active',
          scope TEXT,
          visitFollowUps TEXT,
          chat TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
      `,
      columns: {
        id: 'TEXT PRIMARY KEY',
        name: 'TEXT NOT NULL',
        parent_project_id: 'TEXT',
        client_name: 'TEXT',
        description: 'TEXT',
        details: 'TEXT',
        project_manager_id: 'TEXT',
        team_leader_id: 'TEXT',
        consultant_tl_id: 'TEXT',
        developer_tl_id: 'TEXT',
        phases: 'TEXT',
        start_date: 'TEXT',
        end_date: 'TEXT',
        status: "TEXT DEFAULT 'Active'",
        scope: 'TEXT',
        visitFollowUps: 'TEXT',
        chat: 'TEXT',
        created_at: 'TEXT DEFAULT CURRENT_TIMESTAMP'
      }
    },
    project_tasks: {
      createSql: `
        CREATE TABLE IF NOT EXISTS project_tasks (
          id TEXT PRIMARY KEY,
          project_id TEXT,
          parent_task_id TEXT,
          title TEXT NOT NULL,
          description TEXT,
          phase TEXT,
          sub_phase TEXT,
          priority TEXT DEFAULT 'Medium',
          status TEXT DEFAULT 'Pending',
          creator_id TEXT,
          assigned_to_id TEXT,
          assigned_to TEXT,
          assigned_to_ids TEXT,
          start_date TEXT,
          end_date TEXT,
          actual_start_date TEXT,
          actual_start_time TEXT,
          started_at TEXT,
          estimated_hours REAL,
          completed_at TEXT,
          completion_notes TEXT,
          sub_tasks TEXT,
          attachments TEXT,
          comments TEXT,
          workflow_log TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
      `,
      columns: {
        id: 'TEXT PRIMARY KEY',
        project_id: 'TEXT',
        parent_task_id: 'TEXT',
        title: 'TEXT NOT NULL',
        description: 'TEXT',
        phase: 'TEXT',
        sub_phase: 'TEXT',
        priority: "TEXT DEFAULT 'Medium'",
        status: "TEXT DEFAULT 'Pending'",
        creator_id: 'TEXT',
        assigned_to_id: 'TEXT',
        assigned_to: 'TEXT',
        assigned_to_ids: 'TEXT',
        start_date: 'TEXT',
        end_date: 'TEXT',
        actual_start_date: 'TEXT',
        actual_start_time: 'TEXT',
        started_at: 'TEXT',
        estimated_hours: 'REAL',
        completed_at: 'TEXT',
        completion_notes: 'TEXT',
        sub_tasks: 'TEXT',
        attachments: 'TEXT',
        comments: 'TEXT',
        workflow_log: 'TEXT',
        created_at: 'TEXT DEFAULT CURRENT_TIMESTAMP',
        updated_at: 'TEXT DEFAULT CURRENT_TIMESTAMP'
      }
    },
    transactions: {
      createSql: `
        CREATE TABLE IF NOT EXISTS transactions (
          id TEXT PRIMARY KEY,
          employee_id TEXT NOT NULL,
          month TEXT NOT NULL,
          actual_work_days INTEGER,
          basic_salary REAL,
          housing_allowance REAL,
          transport_allowance REAL,
          subsistence_allowance REAL,
          other_allowances REAL,
          mobile_allowance REAL,
          management_allowance REAL,
          mission_allowance REAL,
          other_income REAL,
          overtime_hours REAL,
          overtime_value REAL,
          total_income REAL,
          social_insurance REAL,
          salary_received REAL,
          loans REAL,
          bank_received REAL,
          tax_value REAL DEFAULT 0,
          other_deductions REAL,
          deduction_hours REAL,
          departure_delay_deduction REAL,
          absence_days REAL,
          absence_deduction REAL,
          unpaid_leave_days REAL,
          unpaid_leave_deduction REAL,
          total_deductions REAL,
          net_salary REAL,
          status TEXT,
          salary_increase REAL,
          other_income_reason TEXT,
          notes TEXT,
          daily_work_hours INTEGER,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
      `,
      columns: {
        id: 'TEXT PRIMARY KEY',
        employee_id: 'TEXT NOT NULL',
        month: 'TEXT NOT NULL',
        actual_work_days: 'INTEGER',
        basic_salary: 'REAL',
        housing_allowance: 'REAL',
        transport_allowance: 'REAL',
        subsistence_allowance: 'REAL',
        other_allowances: 'REAL',
        mobile_allowance: 'REAL',
        management_allowance: 'REAL',
        mission_allowance: 'REAL',
        other_income: 'REAL',
        overtime_hours: 'REAL',
        overtime_value: 'REAL',
        total_income: 'REAL',
        social_insurance: 'REAL',
        salary_received: 'REAL',
        loans: 'REAL',
        bank_received: 'REAL',
        tax_value: 'REAL DEFAULT 0',
        other_deductions: 'REAL',
        deduction_hours: 'REAL',
        departure_delay_deduction: 'REAL',
        absence_days: 'REAL',
        absence_deduction: 'REAL',
        unpaid_leave_days: 'REAL',
        unpaid_leave_deduction: 'REAL',
        total_deductions: 'REAL',
        net_salary: 'REAL',
        status: 'TEXT',
        salary_increase: 'REAL',
        other_income_reason: 'TEXT',
        notes: 'TEXT',
        daily_work_hours: 'INTEGER',
        created_at: 'TEXT DEFAULT CURRENT_TIMESTAMP'
      }
    },
    payroll_runs: {
      createSql: `
        CREATE TABLE IF NOT EXISTS payroll_runs (
          id TEXT PRIMARY KEY,
          run_number TEXT NOT NULL,
          month TEXT NOT NULL,
          period_from TEXT,
          period_to TEXT,
          payroll_group TEXT,
          legal_entity TEXT,
          status TEXT DEFAULT 'Draft',
          total_gross REAL DEFAULT 0,
          total_deductions REAL DEFAULT 0,
          total_net REAL DEFAULT 0,
          employee_count INTEGER DEFAULT 0,
          created_by TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          submitted_by TEXT,
          submitted_at TEXT,
          reviewed_by TEXT,
          reviewed_at TEXT,
          approved_by TEXT,
          approved_at TEXT,
          locked_by TEXT,
          locked_at TEXT,
          notes TEXT,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
      `,
      columns: {
        id: 'TEXT PRIMARY KEY',
        run_number: 'TEXT NOT NULL',
        month: 'TEXT NOT NULL',
        period_from: 'TEXT',
        period_to: 'TEXT',
        payroll_group: 'TEXT',
        legal_entity: 'TEXT',
        status: "TEXT DEFAULT 'Draft'",
        total_gross: 'REAL DEFAULT 0',
        total_deductions: 'REAL DEFAULT 0',
        total_net: 'REAL DEFAULT 0',
        employee_count: 'INTEGER DEFAULT 0',
        created_by: 'TEXT',
        created_at: 'TEXT DEFAULT CURRENT_TIMESTAMP',
        submitted_by: 'TEXT',
        submitted_at: 'TEXT',
        reviewed_by: 'TEXT',
        reviewed_at: 'TEXT',
        approved_by: 'TEXT',
        approved_at: 'TEXT',
        locked_by: 'TEXT',
        locked_at: 'TEXT',
        notes: 'TEXT',
        updated_at: 'TEXT DEFAULT CURRENT_TIMESTAMP'
      }
    },
    leave_requests: {
      createSql: `
        CREATE TABLE IF NOT EXISTS leave_requests (
          id TEXT PRIMARY KEY,
          employee_id TEXT NOT NULL,
          manager_id TEXT,
          start_date TEXT NOT NULL,
          end_date TEXT NOT NULL,
          days_count INTEGER,
          type TEXT NOT NULL,
          reason TEXT,
          attachment_url TEXT,
          status TEXT DEFAULT 'Pending',
          workflow_status TEXT,
          review_note TEXT,
          actual_return_date TEXT,
          return_request_status TEXT,
          return_request_notes TEXT,
          return_request_approved_at TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
      `,
      columns: {
        id: 'TEXT PRIMARY KEY',
        employee_id: 'TEXT NOT NULL',
        manager_id: 'TEXT',
        start_date: 'TEXT NOT NULL',
        end_date: 'TEXT NOT NULL',
        days_count: 'INTEGER',
        type: 'TEXT NOT NULL',
        reason: 'TEXT',
        attachment_url: 'TEXT',
        status: "TEXT DEFAULT 'Pending'",
        workflow_status: 'TEXT',
        review_note: 'TEXT',
        actual_return_date: 'TEXT',
        return_request_status: 'TEXT',
        return_request_notes: 'TEXT',
        return_request_approved_at: 'TEXT',
        created_at: 'TEXT DEFAULT CURRENT_TIMESTAMP',
        updated_at: 'TEXT DEFAULT CURRENT_TIMESTAMP'
      }
    },
    wifi_attendance_networks: {
      createSql: `
        CREATE TABLE IF NOT EXISTS wifi_attendance_networks (
          id TEXT PRIMARY KEY,
          network_name TEXT NOT NULL,
          ssid TEXT,
          public_ip TEXT,
          gateway_ip TEXT,
          allowed_ip_start TEXT,
          allowed_ip_end TEXT,
          ip_range_cidr TEXT,
          latitude REAL,
          longitude REAL,
          allowed_radius_meters INTEGER DEFAULT 100,
          minimum_required_matches INTEGER DEFAULT 2,
          branch_id TEXT,
          applies_to_type TEXT,
          applies_to_value TEXT,
          verification_mode TEXT,
          is_active INTEGER DEFAULT 1,
          allow_check_in INTEGER DEFAULT 1,
          allow_check_out INTEGER DEFAULT 1,
          notes TEXT,
          created_by TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_by TEXT,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
      `,
      columns: {
        id: 'TEXT PRIMARY KEY',
        network_name: 'TEXT NOT NULL',
        ssid: 'TEXT',
        public_ip: 'TEXT',
        gateway_ip: 'TEXT',
        allowed_ip_start: 'TEXT',
        allowed_ip_end: 'TEXT',
        ip_range_cidr: 'TEXT',
        latitude: 'REAL',
        longitude: 'REAL',
        allowed_radius_meters: 'INTEGER DEFAULT 100',
        minimum_required_matches: 'INTEGER DEFAULT 2',
        branch_id: 'TEXT',
        applies_to_type: 'TEXT',
        applies_to_value: 'TEXT',
        verification_mode: 'TEXT',
        is_active: 'INTEGER DEFAULT 1',
        allow_check_in: 'INTEGER DEFAULT 1',
        allow_check_out: 'INTEGER DEFAULT 1',
        notes: 'TEXT',
        created_by: 'TEXT',
        created_at: 'TEXT DEFAULT CURRENT_TIMESTAMP',
        updated_by: 'TEXT',
        updated_at: 'TEXT DEFAULT CURRENT_TIMESTAMP'
      }
    },
    attendance_logs: {
      createSql: `
        CREATE TABLE IF NOT EXISTS attendance_logs (
          id TEXT PRIMARY KEY,
          employee_id TEXT NOT NULL,
          attendance_date TEXT NOT NULL,
          action_type TEXT NOT NULL,
          action_time TEXT NOT NULL,
          status TEXT NOT NULL,
          failure_reason TEXT,
          matched_network_id TEXT,
          public_ip TEXT,
          local_ip TEXT,
          ssid TEXT,
          gateway_ip TEXT,
          device_id TEXT,
          browser_info TEXT,
          latitude REAL,
          longitude REAL,
          accuracy REAL,
          validation_details TEXT,
          matched_rules TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
      `,
      columns: {
        id: 'TEXT PRIMARY KEY',
        employee_id: 'TEXT NOT NULL',
        attendance_date: 'TEXT NOT NULL',
        action_type: 'TEXT NOT NULL',
        action_time: 'TEXT NOT NULL',
        status: 'TEXT NOT NULL',
        failure_reason: 'TEXT',
        matched_network_id: 'TEXT',
        public_ip: 'TEXT',
        local_ip: 'TEXT',
        ssid: 'TEXT',
        gateway_ip: 'TEXT',
        device_id: 'TEXT',
        browser_info: 'TEXT',
        latitude: 'REAL',
        longitude: 'REAL',
        accuracy: 'REAL',
        validation_details: 'TEXT',
        matched_rules: 'TEXT',
        created_at: 'TEXT DEFAULT CURRENT_TIMESTAMP'
      }
    },
    mission_requests: {
      createSql: `
        CREATE TABLE IF NOT EXISTS mission_requests (
          id TEXT PRIMARY KEY,
          employee_id TEXT NOT NULL,
          manager_id TEXT,
          mission_type TEXT,
          mission_date TEXT NOT NULL,
          from_time TEXT,
          to_time TEXT,
          destination TEXT,
          purpose TEXT,
          transportation_required INTEGER,
          expected_cost REAL,
          attachment_url TEXT,
          status TEXT DEFAULT 'Pending',
          workflow_status TEXT,
          evaluation TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
      `,
      columns: {
        id: 'TEXT PRIMARY KEY',
        employee_id: 'TEXT NOT NULL',
        manager_id: 'TEXT',
        mission_type: 'TEXT',
        mission_date: 'TEXT NOT NULL',
        from_time: 'TEXT',
        to_time: 'TEXT',
        destination: 'TEXT',
        purpose: 'TEXT',
        transportation_required: 'INTEGER',
        expected_cost: 'REAL',
        attachment_url: 'TEXT',
        status: "TEXT DEFAULT 'Pending'",
        workflow_status: 'TEXT',
        evaluation: 'TEXT',
        created_at: 'TEXT DEFAULT CURRENT_TIMESTAMP',
        updated_at: 'TEXT DEFAULT CURRENT_TIMESTAMP'
      }
    },
    dashboard_notifications: {
      createSql: `
        CREATE TABLE IF NOT EXISTS dashboard_notifications (
          id TEXT PRIMARY KEY,
          employee_id TEXT NOT NULL,
          notification_type TEXT,
          title TEXT NOT NULL,
          message TEXT,
          is_read INTEGER DEFAULT 0,
          related_entity_type TEXT,
          related_entity_id TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
      `,
      columns: {
        id: 'TEXT PRIMARY KEY',
        employee_id: 'TEXT NOT NULL',
        notification_type: 'TEXT',
        title: 'TEXT NOT NULL',
        message: 'TEXT',
        is_read: 'INTEGER DEFAULT 0',
        related_entity_type: 'TEXT',
        related_entity_id: 'TEXT',
        created_at: 'TEXT DEFAULT CURRENT_TIMESTAMP'
      }
    },
    payroll_results: {
      createSql: `
        CREATE TABLE IF NOT EXISTS payroll_results (
          id TEXT PRIMARY KEY,
          payroll_run_id TEXT NOT NULL,
          employee_id TEXT NOT NULL,
          employee_name TEXT NOT NULL,
          iqama_number TEXT,
          work_type TEXT,
          payment_method TEXT,
          bank_account TEXT,
          bank_code TEXT,
          basic_salary REAL,
          housing_allowance REAL,
          gross_base REAL,
          total_income REAL,
          overtime_value REAL,
          absence_deduction REAL,
          total_deductions REAL,
          salary_received REAL,
          bank_received REAL,
          other_earnings REAL,
          bank_export_amount REAL,
          cash_export_amount REAL,
          other_income REAL,
          other_deductions REAL,
          absence_days REAL,
          unpaid_leave_days REAL,
          unpaid_leave_deduction REAL,
          net_salary REAL,
          detailed_deductions TEXT
        );
      `,
      columns: {
        id: 'TEXT PRIMARY KEY',
        payroll_run_id: 'TEXT NOT NULL',
        employee_id: 'TEXT NOT NULL',
        employee_name: 'TEXT NOT NULL',
        iqama_number: 'TEXT',
        work_type: 'TEXT',
        payment_method: 'TEXT',
        bank_account: 'TEXT',
        bank_code: 'TEXT',
        basic_salary: 'REAL',
        housing_allowance: 'REAL',
        gross_base: 'REAL',
        total_income: 'REAL',
        overtime_value: 'REAL',
        absence_deduction: 'REAL',
        total_deductions: 'REAL',
        salary_received: 'REAL',
        bank_received: 'REAL',
        other_earnings: 'REAL',
        bank_export_amount: 'REAL',
        cash_export_amount: 'REAL',
        other_income: 'REAL',
        other_deductions: 'REAL',
        absence_days: 'REAL',
        unpaid_leave_days: 'REAL',
        unpaid_leave_deduction: 'REAL',
        net_salary: 'REAL',
        detailed_deductions: 'TEXT'
      }
    },
    system_logs: {
      createSql: `
        CREATE TABLE IF NOT EXISTS system_logs (
          id TEXT PRIMARY KEY,
          user_id TEXT,
          user_name TEXT,
          action TEXT NOT NULL,
          entity TEXT,
          entity_id TEXT,
          details TEXT,
          timestamp TEXT DEFAULT CURRENT_TIMESTAMP
        );
      `,
      columns: {
        id: 'TEXT PRIMARY KEY',
        user_id: 'TEXT',
        user_name: 'TEXT',
        action: 'TEXT NOT NULL',
        entity: 'TEXT',
        entity_id: 'TEXT',
        details: 'TEXT',
        timestamp: 'TEXT DEFAULT CURRENT_TIMESTAMP'
      }
    },
    system_settings: {
      createSql: `
        CREATE TABLE IF NOT EXISTS system_settings (
          id TEXT PRIMARY KEY,
          organization_name TEXT NOT NULL DEFAULT 'OPerix',
          logo_url TEXT,
          lock_password TEXT,
          idle_timeout_minutes INTEGER DEFAULT 5,
          is_lock_enabled INTEGER DEFAULT 0,
          primary_color TEXT DEFAULT '#0ea5e9',
          secondary_color TEXT DEFAULT '#10b981',
          sidebar_color TEXT DEFAULT '#0f172a',
          button_color TEXT DEFAULT '#0ea5e9',
          dark_mode_enabled INTEGER DEFAULT 0,
          default_language TEXT DEFAULT 'ar',
          overtime_rate REAL DEFAULT 1.5,
          delay_hourly_rate REAL DEFAULT 1.0,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
      `,
      columns: {
        id: 'TEXT PRIMARY KEY',
        organization_name: "TEXT NOT NULL DEFAULT 'OPerix'",
        logo_url: 'TEXT',
        lock_password: 'TEXT',
        idle_timeout_minutes: 'INTEGER DEFAULT 5',
        is_lock_enabled: 'INTEGER DEFAULT 0',
        primary_color: "TEXT DEFAULT '#0ea5e9'",
        secondary_color: "TEXT DEFAULT '#10b981'",
        sidebar_color: "TEXT DEFAULT '#0f172a'",
        button_color: "TEXT DEFAULT '#0ea5e9'",
        dark_mode_enabled: 'INTEGER DEFAULT 0',
        default_language: "TEXT DEFAULT 'ar'",
        overtime_rate: 'REAL DEFAULT 1.5',
        delay_hourly_rate: 'REAL DEFAULT 1.0',
        updated_at: 'TEXT DEFAULT CURRENT_TIMESTAMP'
      }
    },
    financial_advances: {
      createSql: `
        CREATE TABLE IF NOT EXISTS financial_advances (
          id TEXT PRIMARY KEY,
          employee_id TEXT NOT NULL,
          project_id TEXT,
          month TEXT NOT NULL,
          amount REAL NOT NULL DEFAULT 0,
          status TEXT NOT NULL DEFAULT 'Draft',
          notes TEXT,
          ref_number TEXT,
          created_at TEXT NOT NULL,
          disbursed_at TEXT
        );
      `,
      columns: {
        id: 'TEXT PRIMARY KEY',
        employee_id: 'TEXT NOT NULL',
        project_id: 'TEXT',
        month: 'TEXT NOT NULL',
        amount: 'REAL NOT NULL DEFAULT 0',
        status: "TEXT NOT NULL DEFAULT 'Draft'",
        notes: 'TEXT',
        ref_number: 'TEXT',
        created_at: 'TEXT NOT NULL',
        disbursed_at: 'TEXT'
      }
    },
    mission_disbursals: {
      createSql: `
        CREATE TABLE IF NOT EXISTS mission_disbursals (
          id TEXT PRIMARY KEY,
          employee_id TEXT NOT NULL,
          month TEXT NOT NULL,
          total_amount REAL NOT NULL DEFAULT 0,
          paid_amount REAL NOT NULL DEFAULT 0,
          status TEXT NOT NULL DEFAULT 'Draft',
          payments TEXT DEFAULT '[]',
          notes TEXT
        );
      `,
      columns: {
        id: 'TEXT PRIMARY KEY',
        employee_id: 'TEXT NOT NULL',
        month: 'TEXT NOT NULL',
        total_amount: 'REAL NOT NULL DEFAULT 0',
        paid_amount: 'REAL NOT NULL DEFAULT 0',
        status: "TEXT NOT NULL DEFAULT 'Draft'",
        payments: "TEXT DEFAULT '[]'",
        notes: 'TEXT'
      }
    },
    mission_allowance_runs: {
      createSql: `
        CREATE TABLE IF NOT EXISTS mission_allowance_runs (
          id TEXT PRIMARY KEY,
          run_number TEXT NOT NULL,
          period_from TEXT NOT NULL,
          period_to TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'Draft',
          created_by TEXT,
          created_at TEXT NOT NULL,
          submitted_by TEXT,
          submitted_at TEXT,
          approved_by TEXT,
          approved_at TEXT,
          locked_by TEXT,
          locked_at TEXT,
          total_employees INTEGER DEFAULT 0,
          total_missions INTEGER DEFAULT 0,
          total_allowance_amount REAL DEFAULT 0,
          notes TEXT
        );
      `,
      columns: {
        id: 'TEXT PRIMARY KEY',
        run_number: 'TEXT NOT NULL',
        period_from: 'TEXT NOT NULL',
        period_to: 'TEXT NOT NULL',
        status: "TEXT NOT NULL DEFAULT 'Draft'",
        created_by: 'TEXT',
        created_at: 'TEXT NOT NULL',
        submitted_by: 'TEXT',
        submitted_at: 'TEXT',
        approved_by: 'TEXT',
        approved_at: 'TEXT',
        locked_by: 'TEXT',
        locked_at: 'TEXT',
        total_employees: 'INTEGER DEFAULT 0',
        total_missions: 'INTEGER DEFAULT 0',
        total_allowance_amount: 'REAL DEFAULT 0',
        notes: 'TEXT'
      }
    },
    mission_allowance_run_lines: {
      createSql: `
        CREATE TABLE IF NOT EXISTS mission_allowance_run_lines (
          id TEXT PRIMARY KEY,
          run_id TEXT NOT NULL,
          employee_id TEXT NOT NULL,
          employee_name TEXT NOT NULL,
          mission_id TEXT NOT NULL,
          mission_date_from TEXT,
          mission_date_to TEXT,
          mission_days INTEGER DEFAULT 1,
          destination TEXT,
          allowance_type TEXT,
          daily_allowance_rate REAL DEFAULT 0,
          total_allowance_amount REAL DEFAULT 0,
          payment_method TEXT,
          bank_account TEXT,
          cash_amount REAL DEFAULT 0,
          bank_amount REAL DEFAULT 0,
          status TEXT DEFAULT 'Draft',
          notes TEXT
        );
      `,
      columns: {
        id: 'TEXT PRIMARY KEY',
        run_id: 'TEXT NOT NULL',
        employee_id: 'TEXT NOT NULL',
        employee_name: 'TEXT NOT NULL',
        mission_id: 'TEXT NOT NULL',
        mission_date_from: 'TEXT',
        mission_date_to: 'TEXT',
        mission_days: 'INTEGER DEFAULT 1',
        destination: 'TEXT',
        allowance_type: 'TEXT',
        daily_allowance_rate: 'REAL DEFAULT 0',
        total_allowance_amount: 'REAL DEFAULT 0',
        payment_method: 'TEXT',
        bank_account: 'TEXT',
        cash_amount: 'REAL DEFAULT 0',
        bank_amount: 'REAL DEFAULT 0',
        status: "TEXT DEFAULT 'Draft'",
        notes: 'TEXT'
      }
    },
    audit_logs: {
      createSql: `
        CREATE TABLE IF NOT EXISTS audit_logs (
          id TEXT PRIMARY KEY,
          user_id TEXT,
          action TEXT NOT NULL,
          entity_type TEXT NOT NULL,
          entity_id TEXT,
          old_value TEXT,
          new_value TEXT,
          timestamp TEXT NOT NULL,
          ip_address TEXT
        );
      `,
      columns: {
        id: 'TEXT PRIMARY KEY',
        user_id: 'TEXT',
        action: 'TEXT NOT NULL',
        entity_type: 'TEXT NOT NULL',
        entity_id: 'TEXT',
        old_value: 'TEXT',
        new_value: 'TEXT',
        timestamp: 'TEXT NOT NULL',
        ip_address: 'TEXT'
      }
    },
    end_of_service_settlements: {
      createSql: `
        CREATE TABLE IF NOT EXISTS end_of_service_settlements (
          id TEXT PRIMARY KEY,
          employee_id TEXT NOT NULL,
          termination_date TEXT NOT NULL,
          last_working_day TEXT NOT NULL,
          reason TEXT NOT NULL,
          last_salary_due REAL DEFAULT 0,
          leave_balance_amount REAL DEFAULT 0,
          end_of_service_benefit REAL DEFAULT 0,
          loans REAL DEFAULT 0,
          advances REAL DEFAULT 0,
          deductions REAL DEFAULT 0,
          custody_deductions REAL DEFAULT 0,
          insurance_deductions REAL DEFAULT 0,
          net_settlement REAL DEFAULT 0,
          status TEXT NOT NULL DEFAULT 'Draft',
          hr_notes TEXT,
          finance_notes TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
      `,
      columns: {
        id: 'TEXT PRIMARY KEY',
        employee_id: 'TEXT NOT NULL',
        termination_date: 'TEXT NOT NULL',
        last_working_day: 'TEXT NOT NULL',
        reason: 'TEXT NOT NULL',
        last_salary_due: 'REAL DEFAULT 0',
        leave_balance_amount: 'REAL DEFAULT 0',
        end_of_service_benefit: 'REAL DEFAULT 0',
        loans: 'REAL DEFAULT 0',
        advances: 'REAL DEFAULT 0',
        deductions: 'REAL DEFAULT 0',
        custody_deductions: 'REAL DEFAULT 0',
        insurance_deductions: 'REAL DEFAULT 0',
        net_settlement: 'REAL DEFAULT 0',
        status: "TEXT NOT NULL DEFAULT 'Draft'",
        hr_notes: 'TEXT',
        finance_notes: 'TEXT',
        created_at: 'TEXT NOT NULL',
        updated_at: 'TEXT NOT NULL'
      }
    },
    penalties: {
      createSql: `
        CREATE TABLE IF NOT EXISTS penalties (
          id TEXT PRIMARY KEY,
          penalty_number TEXT NOT NULL,
          employee_id TEXT NOT NULL,
          employee_name TEXT,
          department_id TEXT,
          violation_date TEXT NOT NULL,
          penalty_date TEXT NOT NULL,
          violation_type TEXT NOT NULL,
          description TEXT NOT NULL,
          attachment_url TEXT,
          penalty_type TEXT NOT NULL,
          deduction_type TEXT,
          deduction_value REAL DEFAULT 0,
          target_month TEXT,
          fiscal_year TEXT,
          submitter_id TEXT,
          approver_id TEXT,
          status TEXT DEFAULT 'Draft',
          admin_notes TEXT,
          employee_notes TEXT,
          disciplinary_approval_type TEXT DEFAULT 'Approved by Direct Manager',
          reference_number TEXT,
          audit_trail TEXT,
          rejection_reason TEXT,
          return_reason TEXT,
          direct_manager_decision TEXT,
          direct_manager_objection_reason TEXT,
          direct_manager_notes TEXT,
          higher_manager_decision TEXT,
          higher_manager_objection_reason TEXT,
          higher_manager_notes TEXT,
          hr_decision TEXT,
          cancellation_reason TEXT,
          has_grievance INTEGER DEFAULT 0,
          grievance_status TEXT DEFAULT 'None',
          grievance_date TEXT,
          grievance_reason TEXT,
          grievance_reply TEXT,
          grievance_reply_date TEXT,
          grievance_resolved_by TEXT,
          pre_grievance_penalty_type TEXT,
          pre_grievance_deduction_type TEXT,
          pre_grievance_deduction_value REAL DEFAULT 0,
          pre_grievance_description TEXT,
          post_grievance_penalty_type TEXT,
          post_grievance_deduction_type TEXT,
          post_grievance_deduction_value REAL DEFAULT 0,
          post_grievance_notes TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
      `,
      columns: {
        id: 'TEXT PRIMARY KEY',
        penalty_number: 'TEXT NOT NULL',
        employee_id: 'TEXT NOT NULL',
        employee_name: 'TEXT',
        department_id: 'TEXT',
        violation_date: 'TEXT NOT NULL',
        penalty_date: 'TEXT NOT NULL',
        violation_type: 'TEXT NOT NULL',
        description: 'TEXT NOT NULL',
        attachment_url: 'TEXT',
        penalty_type: 'TEXT NOT NULL',
        deduction_type: 'TEXT',
        deduction_value: 'REAL DEFAULT 0',
        target_month: 'TEXT',
        fiscal_year: 'TEXT',
        submitter_id: 'TEXT',
        approver_id: 'TEXT',
        status: "TEXT DEFAULT 'Draft'",
        admin_notes: 'TEXT',
        employee_notes: 'TEXT',
        disciplinary_approval_type: "TEXT DEFAULT 'Approved by Direct Manager'",
        reference_number: 'TEXT',
        audit_trail: 'TEXT',
        rejection_reason: 'TEXT',
        return_reason: 'TEXT',
        direct_manager_decision: 'TEXT',
        direct_manager_objection_reason: 'TEXT',
        direct_manager_notes: 'TEXT',
        higher_manager_decision: 'TEXT',
        higher_manager_objection_reason: 'TEXT',
        higher_manager_notes: 'TEXT',
        hr_decision: 'TEXT',
        cancellation_reason: 'TEXT',
        has_grievance: 'INTEGER DEFAULT 0',
        grievance_status: "TEXT DEFAULT 'None'",
        grievance_date: 'TEXT',
        grievance_reason: 'TEXT',
        grievance_reply: 'TEXT',
        grievance_reply_date: 'TEXT',
        grievance_resolved_by: 'TEXT',
        pre_grievance_penalty_type: 'TEXT',
        pre_grievance_deduction_type: 'TEXT',
        pre_grievance_deduction_value: 'REAL DEFAULT 0',
        pre_grievance_description: 'TEXT',
        post_grievance_penalty_type: 'TEXT',
        post_grievance_deduction_type: 'TEXT',
        post_grievance_deduction_value: 'REAL DEFAULT 0',
        post_grievance_notes: 'TEXT',
        created_at: 'TEXT DEFAULT CURRENT_TIMESTAMP',
        updated_at: 'TEXT DEFAULT CURRENT_TIMESTAMP'
      }
    },
    deduction_master_types: {
      createSql: `
        CREATE TABLE IF NOT EXISTS deduction_master_types (
          id TEXT PRIMARY KEY,
          code TEXT NOT NULL,
          name_ar TEXT NOT NULL,
          name_en TEXT NOT NULL,
          category TEXT NOT NULL,
          description TEXT,
          status TEXT DEFAULT 'Active',
          start_date TEXT,
          end_date TEXT,
          calculation_method TEXT NOT NULL,
          fixed_amount REAL DEFAULT 0,
          percentage REAL DEFAULT 0,
          brackets TEXT,
          equation TEXT,
          charge_type TEXT NOT NULL,
          employee_percentage REAL DEFAULT 0,
          company_percentage REAL DEFAULT 0,
          employee_amount REAL DEFAULT 0,
          company_amount REAL DEFAULT 0,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
      `,
      columns: {
        id: 'TEXT PRIMARY KEY',
        code: 'TEXT NOT NULL',
        name_ar: 'TEXT NOT NULL',
        name_en: 'TEXT NOT NULL',
        category: 'TEXT NOT NULL',
        description: 'TEXT',
        status: "TEXT DEFAULT 'Active'",
        start_date: 'TEXT',
        end_date: 'TEXT',
        calculation_method: 'TEXT NOT NULL',
        fixed_amount: 'REAL DEFAULT 0',
        percentage: 'REAL DEFAULT 0',
        brackets: 'TEXT',
        equation: 'TEXT',
        charge_type: 'TEXT NOT NULL',
        employee_percentage: 'REAL DEFAULT 0',
        company_percentage: 'REAL DEFAULT 0',
        employee_amount: 'REAL DEFAULT 0',
        company_amount: 'REAL DEFAULT 0',
        created_at: 'TEXT DEFAULT CURRENT_TIMESTAMP',
        updated_at: 'TEXT DEFAULT CURRENT_TIMESTAMP'
      }
    },
    deduction_master_transactions: {
      createSql: `
        CREATE TABLE IF NOT EXISTS deduction_master_transactions (
          id TEXT PRIMARY KEY,
          form_number TEXT NOT NULL,
          month TEXT NOT NULL,
          year TEXT NOT NULL,
          company TEXT,
          department_id TEXT,
          status TEXT DEFAULT 'Draft',
          notes TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
      `,
      columns: {
        id: 'TEXT PRIMARY KEY',
        form_number: 'TEXT NOT NULL',
        month: 'TEXT NOT NULL',
        year: 'TEXT NOT NULL',
        company: 'TEXT',
        department_id: 'TEXT',
        status: "TEXT DEFAULT 'Draft'",
        notes: 'TEXT',
        created_at: 'TEXT DEFAULT CURRENT_TIMESTAMP',
        updated_at: 'TEXT DEFAULT CURRENT_TIMESTAMP'
      }
    },
    deduction_master_transaction_lines: {
      createSql: `
        CREATE TABLE IF NOT EXISTS deduction_master_transaction_lines (
          id TEXT PRIMARY KEY,
          transaction_id TEXT NOT NULL,
          employee_id TEXT NOT NULL,
          deduction_type_id TEXT NOT NULL,
          calculated_value REAL DEFAULT 0,
          company_value REAL DEFAULT 0,
          notes TEXT
        );
      `,
      columns: {
        id: 'TEXT PRIMARY KEY',
        transaction_id: 'TEXT NOT NULL',
        employee_id: 'TEXT NOT NULL',
        deduction_type_id: 'TEXT NOT NULL',
        calculated_value: 'REAL DEFAULT 0',
        company_value: 'REAL DEFAULT 0',
        notes: 'TEXT'
      }
    },
    performance_cycles: {
      createSql: `
        CREATE TABLE IF NOT EXISTS performance_cycles (
          id TEXT PRIMARY KEY,
          name_ar TEXT NOT NULL,
          name_en TEXT NOT NULL,
          year TEXT NOT NULL,
          cycle_type TEXT NOT NULL,
          template_id TEXT,
          start_date TEXT NOT NULL,
          end_date TEXT NOT NULL,
          status TEXT DEFAULT 'Draft',
          target_departments TEXT,
          require_self_eval INTEGER DEFAULT 1,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
      `,
      columns: {
        id: 'TEXT PRIMARY KEY',
        name_ar: 'TEXT NOT NULL',
        name_en: 'TEXT NOT NULL',
        year: 'TEXT NOT NULL',
        cycle_type: 'TEXT NOT NULL',
        template_id: 'TEXT',
        start_date: 'TEXT NOT NULL',
        end_date: 'TEXT NOT NULL',
        status: "TEXT DEFAULT 'Draft'",
        target_departments: 'TEXT',
        require_self_eval: 'INTEGER DEFAULT 1',
        created_at: 'TEXT DEFAULT CURRENT_TIMESTAMP',
        updated_at: 'TEXT DEFAULT CURRENT_TIMESTAMP'
      }
    },
    performance_templates: {
      createSql: `
        CREATE TABLE IF NOT EXISTS performance_templates (
          id TEXT PRIMARY KEY,
          name_ar TEXT NOT NULL,
          name_en TEXT NOT NULL,
          description TEXT,
          job_types TEXT,
          target_departments TEXT,
          success_rate REAL DEFAULT 70,
          status TEXT DEFAULT 'Active',
          sections TEXT,
          require_self_eval INTEGER DEFAULT 1,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
      `,
      columns: {
        id: 'TEXT PRIMARY KEY',
        name_ar: 'TEXT NOT NULL',
        name_en: 'TEXT NOT NULL',
        description: 'TEXT',
        job_types: 'TEXT',
        target_departments: 'TEXT',
        success_rate: 'REAL DEFAULT 70',
        status: "TEXT DEFAULT 'Active'",
        sections: 'TEXT',
        require_self_eval: 'INTEGER DEFAULT 1',
        created_at: 'TEXT DEFAULT CURRENT_TIMESTAMP',
        updated_at: 'TEXT DEFAULT CURRENT_TIMESTAMP'
      }
    },
    performance_criteria: {
      createSql: `
        CREATE TABLE IF NOT EXISTS performance_criteria (
          id TEXT PRIMARY KEY,
          name_ar TEXT NOT NULL,
          name_en TEXT NOT NULL,
          weight REAL DEFAULT 10,
          response_type TEXT NOT NULL,
          criterion_key TEXT,
          is_enabled INTEGER DEFAULT 1,
          is_auto_calculated INTEGER DEFAULT 0,
          description_ar TEXT,
          description_en TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
      `,
      columns: {
        id: 'TEXT PRIMARY KEY',
        name_ar: 'TEXT NOT NULL',
        name_en: 'TEXT NOT NULL',
        weight: 'REAL DEFAULT 10',
        response_type: 'TEXT NOT NULL',
        criterion_key: 'TEXT',
        is_enabled: 'INTEGER DEFAULT 1',
        is_auto_calculated: 'INTEGER DEFAULT 0',
        description_ar: 'TEXT',
        description_en: 'TEXT',
        created_at: 'TEXT DEFAULT CURRENT_TIMESTAMP',
        updated_at: 'TEXT DEFAULT CURRENT_TIMESTAMP'
      }
    },
    performance_evaluations: {
      createSql: `
        CREATE TABLE IF NOT EXISTS performance_evaluations (
          id TEXT PRIMARY KEY,
          employee_id TEXT NOT NULL,
          cycle_id TEXT NOT NULL,
          template_id TEXT NOT NULL,
          manager_id TEXT,
          higher_level_manager_id TEXT,
          dept_head_id TEXT,
          hr_id TEXT,
          status TEXT DEFAULT 'PendingSelf',
          return_reason TEXT,
          rejection_reason TEXT,
          audit_trail TEXT,
          self_weight REAL DEFAULT 10,
          manager_weight REAL DEFAULT 60,
          dept_head_weight REAL DEFAULT 20,
          hr_weight REAL DEFAULT 10,
          self_scores TEXT,
          manager_scores TEXT,
          dept_head_scores TEXT,
          hr_scores TEXT,
          system_calculated_score REAL DEFAULT 0,
          system_score_breakdown TEXT,
          system_suggested_percentage REAL DEFAULT 0,
          higher_manager_decision TEXT,
          higher_manager_custom_score REAL,
          higher_manager_notes TEXT,
          decision_source TEXT,
          is_self_evaluation_enabled INTEGER DEFAULT 1,
          self_strengths TEXT,
          self_improvements TEXT,
          self_recommendations TEXT,
          manager_strengths TEXT,
          manager_improvements TEXT,
          manager_recommendations TEXT,
          dept_head_strengths TEXT,
          dept_head_improvements TEXT,
          dept_head_recommendations TEXT,
          hr_strengths TEXT,
          hr_improvements TEXT,
          hr_recommendations TEXT,
          final_percentage_score REAL DEFAULT 0,
          final_grade TEXT,
          workflow_log TEXT,
          is_self_submitted INTEGER DEFAULT 0,
          is_manager_submitted INTEGER DEFAULT 0,
          is_dept_head_approved INTEGER DEFAULT 0,
          is_hr_approved INTEGER DEFAULT 0,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
      `,
      columns: {
        id: 'TEXT PRIMARY KEY',
        employee_id: 'TEXT NOT NULL',
        cycle_id: 'TEXT NOT NULL',
        template_id: 'TEXT NOT NULL',
        manager_id: 'TEXT',
        higher_level_manager_id: 'TEXT',
        dept_head_id: 'TEXT',
        hr_id: 'TEXT',
        status: "TEXT DEFAULT 'PendingSelf'",
        return_reason: 'TEXT',
        rejection_reason: 'TEXT',
        audit_trail: 'TEXT',
        self_weight: 'REAL DEFAULT 10',
        manager_weight: 'REAL DEFAULT 60',
        dept_head_weight: 'REAL DEFAULT 20',
        hr_weight: 'REAL DEFAULT 10',
        self_scores: 'TEXT',
        manager_scores: 'TEXT',
        dept_head_scores: 'TEXT',
        hr_scores: 'TEXT',
        system_calculated_score: 'REAL DEFAULT 0',
        system_score_breakdown: 'TEXT',
        system_suggested_percentage: 'REAL DEFAULT 0',
        higher_manager_decision: 'TEXT',
        higher_manager_custom_score: 'REAL',
        higher_manager_notes: 'TEXT',
        decision_source: 'TEXT',
        is_self_evaluation_enabled: 'INTEGER DEFAULT 1',
        self_strengths: 'TEXT',
        self_improvements: 'TEXT',
        self_recommendations: 'TEXT',
        manager_strengths: 'TEXT',
        manager_improvements: 'TEXT',
        manager_recommendations: 'TEXT',
        dept_head_strengths: 'TEXT',
        dept_head_improvements: 'TEXT',
        dept_head_recommendations: 'TEXT',
        hr_strengths: 'TEXT',
        hr_improvements: 'TEXT',
        hr_recommendations: 'TEXT',
        final_percentage_score: 'REAL DEFAULT 0',
        final_grade: 'TEXT',
        workflow_log: 'TEXT',
        is_self_submitted: 'INTEGER DEFAULT 0',
        is_manager_submitted: 'INTEGER DEFAULT 0',
        is_dept_head_approved: 'INTEGER DEFAULT 0',
        is_hr_approved: 'INTEGER DEFAULT 0',
        created_at: 'TEXT DEFAULT CURRENT_TIMESTAMP',
        updated_at: 'TEXT DEFAULT CURRENT_TIMESTAMP'
      }
    },
    performance_development_plans: {
      createSql: `
        CREATE TABLE IF NOT EXISTS performance_development_plans (
          id TEXT PRIMARY KEY,
          employee_id TEXT NOT NULL,
          evaluation_id TEXT NOT NULL,
          weaknesses TEXT,
          training_courses TEXT,
          smart_objectives TEXT,
          progress_percentage REAL DEFAULT 0,
          status TEXT DEFAULT 'Active',
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
      `,
      columns: {
        id: 'TEXT PRIMARY KEY',
        employee_id: 'TEXT NOT NULL',
        evaluation_id: 'TEXT NOT NULL',
        weaknesses: 'TEXT',
        training_courses: 'TEXT',
        smart_objectives: 'TEXT',
        progress_percentage: 'REAL DEFAULT 0',
        status: "TEXT DEFAULT 'Active'",
        created_at: 'TEXT DEFAULT CURRENT_TIMESTAMP',
        updated_at: 'TEXT DEFAULT CURRENT_TIMESTAMP'
      }
    },
    administrative_notices: {
      createSql: `
        CREATE TABLE IF NOT EXISTS administrative_notices (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          content TEXT NOT NULL,
          notice_date TEXT NOT NULL,
          start_date TEXT NOT NULL,
          end_date TEXT,
          duration_days INTEGER DEFAULT 7,
          is_permanent INTEGER DEFAULT 0,
          priority TEXT DEFAULT 'normal',
          category TEXT DEFAULT 'decision',
          target_audience TEXT,
          created_by_name TEXT NOT NULL,
          created_by_role TEXT,
          created_by_id TEXT,
          status TEXT DEFAULT 'Published',
          read_by TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
      `,
      columns: {
        id: 'TEXT PRIMARY KEY',
        title: 'TEXT NOT NULL',
        content: 'TEXT NOT NULL',
        notice_date: 'TEXT NOT NULL',
        start_date: 'TEXT NOT NULL',
        end_date: 'TEXT',
        duration_days: 'INTEGER DEFAULT 7',
        is_permanent: 'INTEGER DEFAULT 0',
        priority: "TEXT DEFAULT 'normal'",
        category: "TEXT DEFAULT 'decision'",
        target_audience: 'TEXT',
        created_by_name: 'TEXT NOT NULL',
        created_by_role: 'TEXT',
        created_by_id: 'TEXT',
        status: "TEXT DEFAULT 'Published'",
        read_by: 'TEXT',
        created_at: 'TEXT DEFAULT CURRENT_TIMESTAMP',
        updated_at: 'TEXT DEFAULT CURRENT_TIMESTAMP'
      }
    },
    investigations: {
      createSql: `
        CREATE TABLE IF NOT EXISTS investigations (
          id TEXT PRIMARY KEY,
          investigation_number TEXT NOT NULL,
          title TEXT NOT NULL,
          reason TEXT NOT NULL,
          investigation_date TEXT NOT NULL,
          investigation_time TEXT NOT NULL,
          location TEXT,
          employee_id TEXT,
          employee_name TEXT,
          employee_ids TEXT,
          manager_ids TEXT,
          investigator_name TEXT,
          status TEXT DEFAULT 'Scheduled',
          notes TEXT,
          recommendation TEXT,
          created_by TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
      `,
      columns: {
        id: 'TEXT PRIMARY KEY',
        investigation_number: 'TEXT NOT NULL',
        title: 'TEXT NOT NULL',
        reason: 'TEXT NOT NULL',
        investigation_date: 'TEXT NOT NULL',
        investigation_time: 'TEXT NOT NULL',
        location: 'TEXT',
        employee_id: 'TEXT',
        employee_name: 'TEXT',
        employee_ids: 'TEXT',
        manager_ids: 'TEXT',
        investigator_name: 'TEXT',
        status: "TEXT DEFAULT 'Scheduled'",
        notes: 'TEXT',
        recommendation: 'TEXT',
        created_by: 'TEXT',
        created_at: 'TEXT DEFAULT CURRENT_TIMESTAMP',
        updated_at: 'TEXT DEFAULT CURRENT_TIMESTAMP'
      }
    }
  };

  // Step 1: Ensure each table exists & add any missing columns
  for (const [tableName, schemaInfo] of Object.entries(tableSchemas)) {
    try {
      dbInstance.exec(schemaInfo.createSql);
    } catch (createErr: any) {
      console.error(`[DB SYNC ERROR] Failed creating table '${tableName}':`, createErr.message);
    }

    // Inspect table info
    try {
      const tableInfo = dbInstance.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>;
      const existingCols = new Set(tableInfo.map(col => col.name.toLowerCase()));

      for (const [colName, colType] of Object.entries(schemaInfo.columns)) {
        if (!existingCols.has(colName.toLowerCase())) {
          try {
            // Remove PRIMARY KEY / UNIQUE constraints from ALTER TABLE as SQLite only supports basic types in ADD COLUMN
            const safeType = colType
              .replace(/PRIMARY KEY/gi, '')
              .replace(/UNIQUE/gi, '')
              .trim();
            dbInstance.exec(`ALTER TABLE ${tableName} ADD COLUMN ${colName} ${safeType};`);
            console.log(`✅ [DB SYNC] Added missing column '${colName}' to table '${tableName}'.`);
          } catch (alterErr: any) {
            if (!alterErr.message.includes('duplicate column name') && !alterErr.message.includes('already exists')) {
              console.warn(`⚠️ [DB SYNC] Failed to add column '${colName}' to '${tableName}':`, alterErr.message);
            }
          }
        }
      }
    } catch (infoErr: any) {
      console.error(`[DB SYNC ERROR] Failed checking columns for '${tableName}':`, infoErr.message);
    }
  }

  // Step 2: Seed default automated & configurable criteria if missing
  try {
    const existingCriteria = dbInstance.prepare("SELECT count(*) as count FROM performance_criteria").get() as any;
    if (!existingCriteria || existingCriteria.count === 0) {
      const defaultCriteria = [
        {
          id: 'crit-tasks',
          name_ar: 'المهام وإنجاز الأعمال والالتزام بالوقت المقدر',
          name_en: 'Tasks Completion & Execution Time Efficiency',
          weight: 25,
          response_type: 'RatingStar',
          criterion_key: 'tasks',
          is_enabled: 1,
          is_auto_calculated: 1,
          description_ar: 'يقيس معدل إنجاز المهام المسندة والتسليم في الموعد المحدد ومقارنة وقت التنفيذ الفعلي بالوقت المقدر.',
          description_en: 'Measures task completion rate, on-time delivery, and actual execution time vs estimated time.'
        },
        {
          id: 'crit-missions',
          name_ar: 'تقييم المأموريات الخارجية والمهام الميدانية',
          name_en: 'Missions & Field Work Evaluation',
          weight: 15,
          response_type: 'RatingStar',
          criterion_key: 'missions',
          is_enabled: 1,
          is_auto_calculated: 1,
          description_ar: 'يُحتسب فقط للموظفين الذين لديهم مأموريات فعلية معتمدة. لا يتم احتسابه ولا يؤثر سلباً على من ليس لديه مأموريات.',
          description_en: 'Calculated only if the employee has assigned missions. Excluded automatically without penalty if none.'
        },
        {
          id: 'crit-attendance',
          name_ar: 'الانضباط ومعدل الحضور والانصراف وساعات العمل',
          name_en: 'Attendance & Punctuality Discipline',
          weight: 15,
          response_type: 'RatingStar',
          criterion_key: 'attendance',
          is_enabled: 1,
          is_auto_calculated: 1,
          description_ar: 'يقيس التزام الموظف بمواعيد الحضور والانصراف، ساعات العمل الفعلية، وتجنب التأخير غير المبرر.',
          description_en: 'Measures punctuality, attendance consistency, and actual working hours compliance.'
        },
        {
          id: 'crit-leaves',
          name_ar: 'الالتزام بسياسات الإجازات والانضباط العام',
          name_en: 'Leaves & Absence Policy Compliance',
          weight: 10,
          response_type: 'RatingStar',
          criterion_key: 'leaves',
          is_enabled: 1,
          is_auto_calculated: 1,
          description_ar: 'يقيس الالتزام بتقديم الإجازات في المواعيد النظامية وعدم الغياب بدون إذن أو انقطاع غير مسوغ.',
          description_en: 'Tracks leaves scheduling compliance and absence rate.'
        },
        {
          id: 'crit-wfh',
          name_ar: 'إنتاجية طلبات العمل من المنزل والالتزام بالمهام',
          name_en: 'Work From Home (WFH) Productivity',
          weight: 10,
          response_type: 'RatingStar',
          criterion_key: 'wfh',
          is_enabled: 1,
          is_auto_calculated: 1,
          description_ar: 'يقيس إنجاز المهام والتواصل الفعال أثناء فترات وأيام العمل عن بعد المصرح بها.',
          description_en: 'Evaluates task delivery and communication efficiency during remote work days.'
        },
        {
          id: 'crit-investigations',
          name_ar: 'سجل التحقيقات الإدارية والالتزام بالقوانين',
          name_en: 'Administrative Investigations & Compliance Record',
          weight: 10,
          response_type: 'RatingStar',
          criterion_key: 'investigations',
          is_enabled: 1,
          is_auto_calculated: 1,
          description_ar: 'يقيس التزام الموظف بلوائح العمل الداخلية وخلو السجل من التحقيقات الإدارية والتجاوزات.',
          description_en: 'Evaluates workplace compliance and freedom from formal investigations.'
        },
        {
          id: 'crit-penalties',
          name_ar: 'سجل الجزاءات والمخالفات التأديبية',
          name_en: 'Disciplinary Penalties & Violations Record',
          weight: 15,
          response_type: 'RatingStar',
          criterion_key: 'penalties',
          is_enabled: 1,
          is_auto_calculated: 1,
          description_ar: 'يقيس الانضباط السلوكي وخلو سجل الموظف من الجزاءات والإنذارات والمخالفات المعتمدة.',
          description_en: 'Measures disciplinary standing and absence of penalties and warnings.'
        }
      ];

      const insertStmt = dbInstance.prepare(`
        INSERT INTO performance_criteria (
          id, name_ar, name_en, weight, response_type, criterion_key, is_enabled, is_auto_calculated, description_ar, description_en, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `);

      for (const crit of defaultCriteria) {
        insertStmt.run(
          crit.id, crit.name_ar, crit.name_en, crit.weight, crit.response_type, crit.criterion_key, crit.is_enabled, crit.is_auto_calculated, crit.description_ar, crit.description_en
        );
      }
      console.log('✅ [DB SEED] 7 Standard performance criteria initialized successfully.');
    }
  } catch (critSeedErr: any) {
    console.error('[DB CRITERIA SEED ERROR]', critSeedErr.message);
  }

  // Step 3: Ensure performance indices on heavy and relational tables
  try {
    dbInstance.exec(`
      CREATE INDEX IF NOT EXISTS idx_attendance_records_emp_time ON attendance_records(employee_id, timestamp);
      CREATE INDEX IF NOT EXISTS idx_attendance_records_time ON attendance_records(timestamp);
      CREATE INDEX IF NOT EXISTS idx_attendance_logs_emp_date ON attendance_logs(employee_id, attendance_date);
      CREATE INDEX IF NOT EXISTS idx_system_logs_time ON system_logs(timestamp);
      CREATE INDEX IF NOT EXISTS idx_system_logs_entity ON system_logs(entity, entity_id);
      CREATE INDEX IF NOT EXISTS idx_notifications_emp ON dashboard_notifications(employee_id, is_read);
      CREATE INDEX IF NOT EXISTS idx_penalties_emp_status ON penalties(employee_id, status);
      CREATE INDEX IF NOT EXISTS idx_employees_dept ON employees(department_id);
      CREATE INDEX IF NOT EXISTS idx_employees_mgr ON employees(manager_id);
      CREATE INDEX IF NOT EXISTS idx_leave_requests_emp_dates ON leave_requests(employee_id, start_date, end_date);
      CREATE INDEX IF NOT EXISTS idx_missions_emp_dates ON missions(employee_id, start_date, end_date);
      CREATE INDEX IF NOT EXISTS idx_payroll_results_run ON payroll_results(payroll_run_id, employee_id);
      CREATE INDEX IF NOT EXISTS idx_project_tasks_proj ON project_tasks(project_id, status);
      CREATE INDEX IF NOT EXISTS idx_project_tasks_assigned ON project_tasks(assigned_to_id);
      CREATE INDEX IF NOT EXISTS idx_transactions_emp_month ON transactions(employee_id, month);
      CREATE INDEX IF NOT EXISTS idx_absence_records_emp_date ON absence_records(employee_id, date);
      CREATE INDEX IF NOT EXISTS idx_perf_eval_emp ON performance_evaluations(employee_id, cycle_id);
      CREATE INDEX IF NOT EXISTS idx_perf_cycles_status ON performance_cycles(status);
    `);
  } catch (e: any) {
    console.error('[DB INDEX CREATION ERROR]', e.message);
  }

  console.log('✅ [DB SYNC] Schema synchronization completed.');
}

// Run initial synchronization immediately on module load
syncDatabaseSchema(sqlite);

// Log database info upon server/startup load
try {
  const currentJournalMode = sqlite.pragma('journal_mode', { simple: true });
  const currentForeignKeys = sqlite.pragma('foreign_keys', { simple: true });
  const currentBusyTimeout = sqlite.pragma('busy_timeout', { simple: true });
  const currentSynchronous = sqlite.pragma('synchronous', { simple: true });

  console.log(`===================================================`);
  console.log(`[DATABASE CONNECTION INITIALIZED]`);
  console.log(`- Path: ${path.resolve(dbPath)}`);
  console.log(`- WAL Mode: ${currentJournalMode}`);
  console.log(`- Foreign Keys: ${currentForeignKeys === 1 || currentForeignKeys === 'on' || currentForeignKeys === true ? 'ON' : 'OFF'}`);
  console.log(`- Busy Timeout: ${currentBusyTimeout}ms`);
  console.log(`- Synchronous: ${currentSynchronous}`);
  console.log(`===================================================`);
} catch (logError) {
  console.error('[DATABASE CONNECT LOG ERROR]', logError);
}

export const db = drizzle(sqlite, { schema });

export * from './schema';
