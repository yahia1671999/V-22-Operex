import { Transaction, PaymentMethod } from '../types';

/**
 * Centralized payroll calculation utility to ensure consistency across the application.
 * All calculations follow the business logic specified for gross base, absence deductions,
 * unpaid leaves, and overtime values as senior ERP payroll requirement.
 */
export const calculatePayrollDetails = (data: Partial<Transaction> & { overtimeBaseSalary?: number; paymentMethod?: PaymentMethod }) => {
  const basicSalary = data.basicSalary || 0;
  const housingAllowance = data.housingAllowance || 0;
  const transportAllowance = data.transportAllowance || 0;
  const subsistenceAllowance = data.subsistenceAllowance || 0;
  const otherAllowances = data.otherAllowances || 0;
  const mobileAllowance = data.mobileAllowance || 0;
  const managementAllowance = data.managementAllowance || 0;
  
  // Overtime Base
  const overtimeBase = data.overtimeBaseSalary !== undefined ? data.overtimeBaseSalary : basicSalary;

  // Daily work hours
  const dailyWorkHours = data.dailyWorkHours || 8;
  const absenceDays = data.absenceDays || 0;
  const unpaidLeaveDays = data.unpaidLeaveDays || 0;
  const overtimeHours = data.overtimeHours || 0;

  // 1. Gross Base: Sum of all recurring monthly components
  const grossBase = basicSalary + housingAllowance + transportAllowance + 
                    subsistenceAllowance + otherAllowances + mobileAllowance + 
                    managementAllowance + (data.missionAllowance || 0);

  // الراتب الخاضع للخصم = (Gross Salary - Housing Allowance)
  const deductibleSalary = grossBase - housingAllowance;
  const dailyDeductionRate = deductibleSalary / 30;

  // 2. Absence Deduction: Pro-rated reduction based on deductible salary (excluding Housing)
  const absenceDeduction = dailyDeductionRate * absenceDays;

  // 3. Unpaid Leave Deduction: value of shift day * unpaid leave days
  const unpaidLeaveDeduction = dailyDeductionRate * unpaidLeaveDays;

  // 4. Overtime Value: calculated on defined base salary and work hours
  const overtimeValue = (overtimeBase / 30 / dailyWorkHours) * 1.5 * overtimeHours;

  const otherIncome = data.otherIncome || 0;
  const salaryIncrease = data.salaryIncrease || 0;
  
  // Total Income: All positive earnings
  const totalIncome = grossBase + otherIncome + overtimeValue + salaryIncrease;

  // Deductions from Employee
  const socialInsurance = data.socialInsurance || 0;
  const taxValue = data.taxValue || 0;
  const salaryReceived = data.salaryReceived || 0;
  const bankReceived = data.bankReceived || 0;
  const loans = data.loans || 0;
  const otherDeductions = data.otherDeductions || 0;
  const deductionHours = data.deductionHours || 0;
  const departureDelayDeduction = data.departureDelayDeduction || 0;
  
  // Hour deduction logic based on contract hourly base
  const hourDeductionValue = deductionHours * (basicSalary / (30 * dailyWorkHours));

  // Total Deductions: All negative impacts on net salary
  const totalDeductions = socialInsurance + taxValue + loans + 
                          otherDeductions + departureDelayDeduction + 
                          absenceDeduction + unpaidLeaveDeduction + hourDeductionValue;

  // Net Salary: Final amount payable to employee
  const netSalary = Math.max(0, totalIncome - totalDeductions);

  const bankExportAmount = data.paymentMethod === 'Bank' ? netSalary : 0;
  const cashExportAmount = data.paymentMethod === 'Cash' ? netSalary : 0;

  const otherEarnings = totalIncome - basicSalary - housingAllowance;

  return {
    grossBase: Number(grossBase.toFixed(2)),
    absenceDeduction: Number(absenceDeduction.toFixed(2)),
    unpaidLeaveDays: Number(unpaidLeaveDays.toFixed(2)),
    unpaidLeaveDeduction: Number(unpaidLeaveDeduction.toFixed(2)),
    overtimeValue: Number(overtimeValue.toFixed(2)),
    totalIncome: Number(totalIncome.toFixed(2)),
    totalDeductions: Number(totalDeductions.toFixed(2)),
    taxValue: Number(taxValue.toFixed(2)),
    netSalary: Number(netSalary.toFixed(2)),
    bankExportAmount: Number(bankExportAmount.toFixed(2)),
    cashExportAmount: Number(cashExportAmount.toFixed(2)),
    bankDeductions: Number((totalIncome - bankExportAmount).toFixed(2)),
    otherEarnings: Number(otherEarnings.toFixed(2)),
    salaryReceived: Number(salaryReceived.toFixed(2)),
    bankReceived: Number(bankReceived.toFixed(2)),
    basicSalary: Number(basicSalary.toFixed(2)),
    housingAllowance: Number(housingAllowance.toFixed(2)),
  };
};
