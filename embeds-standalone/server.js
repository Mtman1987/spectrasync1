const express = require('express');
const app = express();
const port = process.env.PORT || 8080;

app.use(express.json());

const embedBuilders = {
  'vip-live': () => ({
    embeds: [{
      title: '🌟 VIP Live Lounge',
      description: 'VIP embed service is running!',
      color: 0x9146ff,
      timestamp: new Date().toISOString()
    }]
  }),
  
  'raid-pile': () => ({
    embeds: [{
      title: '👑 Raid Pile',
      description: 'Raid pile service is ready!',
      color: 0x9146ff,
      timestamp: new Date().toISOString()
    }]
  }),
  
  'community-pool': () => ({
    embeds: [{
      title: '🌊 Community Pool',
      description: 'Community pool is active!',
      color: 0x00ff7f,
      timestamp: new Date().toISOString()
    }]
  })
};

app.all('/api/embeds', (req, res) => {
  const { type } = req.method === 'GET' ? req.query : req.body;
  
  if (!type) {
    return res.status(400).json({ error: 'Missing embed type' });
  }
  
  const builder = embedBuilders[type.toLowerCase()];
  if (!builder) {
    return res.status(400).json({ error: `Unsupported embed type: ${type}` });
  }
  
  res.json(builder());
});

app.get('/', (req, res) => {
  res.json({ 
    status: 'Cosmic Raid Embeds Service Running',
    available_embeds: Object.keys(embedBuilders)
  });
});

app.listen(port, () => {
  console.log(`Embeds service running on port ${port}`);
});