const express = require('express');
const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));

const app = express();

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

app.use(express.json());

// Função para buscar o place_id da cidade usando a API de Geocodificação
async function obterPlaceIdCidade(query) {
  // Limpa a string (ex: "São Paulo, SP" -> "São Paulo")
  const cidadeLimpa = query.split(',')[0].trim();
  const url = `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(cidadeLimpa)}&type=city&format=json&limit=1&apiKey=${process.env.GEOAPIFY_API_KEY}`;
  
  const resp = await fetch(url);
  const data = await resp.json();
  
  if (data.results && data.results.length > 0) {
    return data.results[0].place_id;
  }
  return null;
}

app.post('/api/search', async (req, res) => {
  try {
    const { query, latitude, longitude } = req.body;
    let url = '';

    // Categorias que abrangem casas de swing, boates e entretenimento adulto
    const categorias = 'amenity.swingerclub,entertainment.nightclub,entertainment,adult';

    if (latitude && longitude) {
      // Busca por GPS (raio de 50km)
      url = `https://api.geoapify.com/v2/places?categories=${categorias}&filter=circle:${longitude},${latitude},50000&limit=10&apiKey=${process.env.GEOAPIFY_API_KEY}`;
    } else if (query) {
      // 1. Tenta achar o ID da cidade
      const placeId = await obterPlaceIdCidade(query);
      
      if (placeId) {
        // 2. Se achou a cidade, busca os estabelecimentos DENTRO dela
        url = `https://api.geoapify.com/v2/places?categories=${categorias}&filter=place:${placeId}&limit=10&apiKey=${process.env.GEOAPIFY_API_KEY}`;
      } else {
        // Se não achar a cidade exata, faz uma busca por proximidade genérica
        url = `https://api.geoapify.com/v2/places?categories=${categorias}&bias=proximity:${encodeURIComponent(query)}&limit=10&apiKey=${process.env.GEOAPIFY_API_KEY}`;
      }
    } else {
      return res.status(400).json({ error: 'Digite um local para pesquisar.' });
    }

    const resp = await fetch(url);
    const data = await resp.json();

    if (!data.features || data.features.length === 0) {
       return res.json({ places: [] });
    }

    const places = data.features.map(f => {
      const props = f.properties;
      return {
        placeId: props.place_id || String(props.datasource?.raw?.osm_id || Math.random()),
        name: props.name || 'Estabelecimento sem nome',
        address: props.formatted || 'Endereço não informado',
        phone: props.contact?.phone || 'Telefone não informado',
        rating: null,
        userRatingsTotal: 0,
        photoUrl: null,
        website: props.website || null,
        googleMapsUri: `https://www.google.com/maps/search/?api=1&query=${props.lat},${props.lon}`,
        lat: props.lat,
        lng: props.lon,
        distance: null,
        pageUrl: null 
      };
    });

    res.json({ places });
  } catch (err) {
    console.error('Erro:', err);
    res.status(500).json({ error: 'Erro ao pesquisar estabelecimentos.' });
  }
});

app.post('/api/create-page', async (req, res) => {
    res.json({ pageUrl: "https://aperdicao.blogspot.com" });
});

module.exports = app;
