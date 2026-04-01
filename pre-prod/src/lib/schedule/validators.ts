// Data validation utilities for scheduling system
export interface EmployeeValidation {
  id: string;
  name: string;
  role: 'Manager' | 'Supervisor' | 'Team Lead' | 'Associate' | 'Trainee';
}

export interface ScheduleValidation {
  id: string;
  employeeId: string;
  date: string; // YYYY-MM-DD format
  shift: 'morning' | 'afternoon' | 'night';
}

export interface LeaveValidation {
  id?: string;
  employeeId: string;
  startDate: string;
  endDate: string;
  leaveTypeId: number;
  status: 'pending' | 'approved' | 'rejected';
}

export class ScheduleValidator {
  static validateEmployee(employee: any): employee is EmployeeValidation {
    if (!employee || typeof employee !== 'object') return false;

    const validRoles = ['Manager', 'Supervisor', 'Team Lead', 'Associate', 'Trainee'];

    return (
      typeof employee.id === 'string' &&
      employee.id.length > 0 &&
      typeof employee.name === 'string' &&
      employee.name.trim().length >= 2 &&
      validRoles.includes(employee.role)
    );
  }

  static validateSchedule(schedule: any): schedule is ScheduleValidation {
    if (!schedule || typeof schedule !== 'object') return false;

    const validShifts = ['morning', 'afternoon', 'night'];
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

    return (
      typeof schedule.id === 'string' &&
      typeof schedule.employeeId === 'string' &&
      schedule.employeeId.length > 0 &&
      typeof schedule.date === 'string' &&
      dateRegex.test(schedule.date) &&
      validShifts.includes(schedule.shift)
    );
  }

  static validateLeave(leave: any): leave is LeaveValidation {
    if (!leave || typeof leave !== 'object') return false;

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    const validStatuses = ['pending', 'approved', 'rejected'];

    const isValid = (
      typeof leave.employeeId === 'string' &&
      leave.employeeId.length > 0 &&
      typeof leave.startDate === 'string' &&
      dateRegex.test(leave.startDate) &&
      typeof leave.endDate === 'string' &&
      dateRegex.test(leave.endDate) &&
      typeof leave.leaveTypeId === 'number' &&
      leave.leaveTypeId > 0 &&
      validStatuses.includes(leave.status)
    );

    if (isValid) {
      // Validate date range
      const startDate = new Date(leave.startDate);
      const endDate = new Date(leave.endDate);
      return endDate >= startDate;
    }

    return false;
  }

  static validateDateRange(startDate: Date, endDate: Date): boolean {
    if (!(startDate instanceof Date) || !(endDate instanceof Date)) return false;
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return false;
    return endDate >= startDate;
  }

  static sanitizeInput(input: string): string {
    return input.trim().replace(/[<>]/g, '');
  }
}
