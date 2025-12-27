//utils/fee.utils.js
export const generateInstallments = (feeStructure, academicYear) => {
  const installments = [];
  const year = academicYear.split('-')[0];

  feeStructure.forEach(rule => {
    if (rule.frequency === 'MONTHLY') {
      const months = ['APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC', 'JAN', 'FEB', 'MAR'];
      months.forEach((month, index) => {
        const monthNum = (index + 3) % 12 + 1;
        const dueDate = new Date(`${year}-${String(monthNum).padStart(2, '0')}-10`);
        installments.push({
          head: rule.head?._id || rule.head,
          headName: rule.headName,
          name: `${month} - ${rule.headName}`,
          amount: rule.amount,
          dueDate,
          paidAmount: 0,
          status: 'PENDING'
        });
      });
    } else if (rule.frequency === 'QUARTERLY') {
      const quarters = [
        { name: 'Q1 (APR-JUN)', dueDate: new Date(`${year}-04-10`) },
        { name: 'Q2 (JUL-SEP)', dueDate: new Date(`${year}-07-10`) },
        { name: 'Q3 (OCT-DEC)', dueDate: new Date(`${year}-10-10`) },
        { name: 'Q4 (JAN-MAR)', dueDate: new Date(`${Number(year) + 1}-01-10`) }
      ];
      quarters.forEach(quarter => {
        installments.push({
          head: rule.head?._id || rule.head,
          headName: rule.headName,
          name: `${quarter.name} - ${rule.headName}`,
          amount: rule.amount * 3,
          dueDate: quarter.dueDate,
          paidAmount: 0,
          status: 'PENDING'
        });
      });
    } else if (rule.frequency === 'YEARLY' || rule.frequency === 'ONE_TIME') {
      const dueDate = new Date(`${year}-04-10`);
      installments.push({
        head: rule.head?._id || rule.head,
        headName: rule.headName,
        name: rule.headName,
        amount: rule.amount,
        dueDate,
        paidAmount: 0,
        status: 'PENDING'
      });
    }
  });

  return installments.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
};
