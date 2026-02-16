const api = {
  getSummary: async () => {
    try {
      // Chiamiamo direttamente le funzioni che Electron mette a disposizione su window.api
      const practices = await window.api.loadPractices() || [];
      const activePractices = practices.filter(p => p.status === 'active').length;
      
      // Calcolo scadenze urgenti (prossimi 7 giorni) come fa la tua Dashboard
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      let urgentCount = 0;
      
      practices.filter(p => p.status === 'active').forEach(p => {
        (p.deadlines || []).forEach(d => {
          const dDate = new Date(d.date);
          const diffDays = Math.ceil((dDate - today) / (1000 * 60 * 60 * 24));
          if (diffDays >= 0 && diffDays <= 7) urgentCount++;
        });
      });

      return {
        activePractices: activePractices,
        urgentDeadlines: urgentCount
      };
    } catch (error) {
      return { activePractices: 0, urgentDeadlines: 0 };
    }
  }
};

export default api;