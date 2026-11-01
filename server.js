require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));
const { google } = require('googleapis');

const app = express();
app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));
app.use(express.json());

const PLACES_URL = 'https://places.googleapis.com/v1/places:searchText';

async function buscarPlaces(textQuery, locationBias) {
  const body = {
    textQuery: textQuery,
    languageCode: 'pt-BR',
    regionCode: 'BR',
    maxResultCount: 10
  };

  if (locationBias) {
    body.locationBias = {
      circle: {
        center: { latitude: locationBias.lat, longitude: locationBias.lng },
        radius: 50000
      }
    };
  }

  const resp = await fetch(PLACES_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': process.env.GOOGLE_PLACES_API_KEY,
      'X-Goog-FieldMask': [
        'places.id', 'places.displayName', 'places.formattedAddress',
        'places.location', 'places.rating', 'places.userRatingCount',
        'places.nationalPhoneNumber', 'places.internationalPhoneNumber',
        'places.currentOpeningHours', 'places.regularOpeningHours',
        'places.priceLevel', 'places.photos', 'places.websiteUri',
        'places.googleMapsUri'
      ].join(',')
    },
    body: JSON.stringify(body)
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error('Places API error: ' + resp.status + ' ' + errText);
  }

  const data = await resp.json();
  return data.places || [];
}

const postsCriados = new Map();

app.post('/api/search', async (req, res) => {
  try {
    const { query, latitude, longitude } = req.body;
    let textQuery = query;

    if (!textQuery && latitude && longitude) {
      textQuery = 'casa de swing clube liberal';
    }

    if (!textQuery) {
      return res.status(400).json({ error: 'Informe uma cidade, estado, nome ou coordenadas.' });
    }

    const termos = [
      textQuery + ' casa de swing',
      textQuery + ' clube liberal',
      textQuery + ' swing club'
    ];

    const locationBias = (latitude && longitude) ? { lat: latitude, lng: longitude } : null;

    let todos = [];
    for (const termo of termos) {
      const resultados = await buscarPlaces(termo, locationBias);
      todos = todos.concat(resultados);
    }

    const vistos = new Set();
    const unicos = [];
    for (const p of todos) {
      if (!vistos.has(p.id)) {
        vistos.add(p.id);
        unicos.push(p);
      }
    }

    const places = unicos.slice(0, 10).map(p => {
      let photoUrl = null;
      if (p.photos && p.photos.length > 0) {
        photoUrl = 'https://places.googleapis.com/v1/' + p.photos[0].name + '/media?maxHeightPx=400&key=' + process.env.GOOGLE_PLACES_API_KEY;
      }

      const postInfo = postsCriados.get(p.id);
      const pageUrl = postInfo ? postInfo.pageUrl : null;

      let distance = null;
      if (latitude && longitude && p.location) {
        distance = haversine(latitude, longitude, p.location.latitude, p.location.longitude);
      }

      return {
        placeId: p.id,
        name: p.displayName ? p.displayName.text : 'Não informado',
        address: p.formattedAddress || 'Não informado',
        phone: p.nationalPhoneNumber || p.internationalPhoneNumber || 'Não informado',
        rating: p.rating || null,
        userRatingsTotal: p.userRatingCount || 0,
        priceLevel: p.priceLevel || null,
        openingHours: p.regularOpeningHours ? p.regularOpeningHours.weekdayDescriptions : [],
        photoUrl: photoUrl,
        website: p.websiteUri || null,
        googleMapsUri: p.googleMapsUri || null,
        lat: p.location ? p.location.latitude : null,
        lng: p.location ? p.location.longitude : null,
        distance: distance,
        pageUrl: pageUrl
      };
    });

    res.json({ places });
  } catch (err) {
    console.error('Erro na pesquisa:', err);
    res.status(500).json({ error: 'Erro ao pesquisar estabelecimentos. Verifique a chave da API no Render.' });
  }
});

app.post('/api/create-page', async (req, res) => {
  try {
    const { placeId } = req.body;
    if (!placeId) return res.status(400).json({ error: 'placeId obrigatório.' });

    if (postsCriados.has(placeId)) {
      return res.json({ pageUrl: postsCriados.get(placeId).pageUrl, existing: true });
    }
    
    // Como você ainda não configurou a API do Blogger, isso vai apenas simular a criação
    // para que o botão não trave, mas não vai criar o post de verdade ainda.
    const postUrl = "https://aperdicao.blogspot.com"; 
    postsCriados.set(placeId, { pageUrl: postUrl, postId: 'simulado' });

    res.json({ pageUrl: postUrl, existing: false });
  } catch (err) {
    res.status(500).json({ error: 'Não foi possível criar a página individual.' });
  }
});

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const toRad = x => x * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('Backend A PERDIÇÃO rodando na porta ' + PORT);
});
