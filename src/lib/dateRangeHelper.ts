export function getDateRangeFilter(dateRange: string): { start: Date; end: Date } {
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  
  let start: Date;
  
  switch (dateRange) {
    case 'today':
      start = new Date(now);
      start.setHours(0, 0, 0, 0);
      break;
    
    case 'yesterday':
      start = new Date(now);
      start.setDate(start.getDate() - 1);
      start.setHours(0, 0, 0, 0);
      end.setDate(end.getDate() - 1);
      break;
    
    case 'last_3d':
      start = new Date(now);
      start.setDate(start.getDate() - 3);
      start.setHours(0, 0, 0, 0);
      break;
    
    case 'last_7d':
      start = new Date(now);
      start.setDate(start.getDate() - 7);
      start.setHours(0, 0, 0, 0);
      break;
    
    case 'last_14d':
      start = new Date(now);
      start.setDate(start.getDate() - 14);
      start.setHours(0, 0, 0, 0);
      break;
    
    case 'last_30d':
      start = new Date(now);
      start.setDate(start.getDate() - 30);
      start.setHours(0, 0, 0, 0);
      break;
    
    case 'this_month':
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      start.setHours(0, 0, 0, 0);
      break;
    
    case 'last_month':
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      start.setHours(0, 0, 0, 0);
      end.setFullYear(now.getFullYear());
      end.setMonth(now.getMonth());
      end.setDate(0); // Last day of previous month
      break;
    
    case 'this_year':
      start = new Date(now.getFullYear(), 0, 1);
      start.setHours(0, 0, 0, 0);
      break;
    
    case 'last_year':
      start = new Date(now.getFullYear() - 1, 0, 1);
      start.setHours(0, 0, 0, 0);
      end.setFullYear(now.getFullYear() - 1);
      end.setMonth(11);
      end.setDate(31);
      break;
    
    case 'lifetime':
    default:
      start = new Date(2020, 0, 1); // Far enough back to include all data
      start.setHours(0, 0, 0, 0);
      break;
  }
  
  return { start, end };
}
