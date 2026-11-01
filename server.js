require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));

const app = express();
app.use(cors());
app.use(express.json());

app.post('/api/search', async (req, res) => {
  try {
    const { query, latitude, longitude } = req.body;
    
    // O Geoapify usa um termo de busca e um local
    let textQuery = query || "casa de swing clube liberal";
    let location = "Brazil";

    if (latitude && longitude) {
      location = `${latitude},${longitude}`;
    } else if (query) {
      location = query;
      textQuery = "casa de swing OR clube liberal OR swing club";
    }

    // Buscando no Geoapify
    const url = `https://api.geoapify.com/v2/places?categories=entertainment,adult,nightclub&filter=rect:-74.0,-33.0,-34.0,5.0&bias=proximity:${location}&text=${textQuery}&limit=10&apiKey=${process.env.GEOAPIFY_API_KEY}`;

    const resp = await fetch(url);
    const data = await resp.json();

    if (!data.features) {
       return res.json({ places: [] });
    }

    // Formatando os dados para o formato que o seu Blogger já espera
    const places = data.features.map(f => {
      const props = f.properties;
      return {
        placeId: props.place_id || props.datasource.raw.osm_id,
        name: props.name || 'Estabelecimento sem nome',
        address: props.formatted || 'Endereço não informado',
        phone: props.contact?.phone || 'Telefone não informado',
        rating: null, // Geoapify não tem nota do Google
        userRatingsTotal: 0,
        photoUrl: null, // Geoapify não fornece fotos
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

// Rota para gerar página individual (apenas simulação por enquanto)
app.post('/api/create-page', async (req, res) => {
    res.json({ pageUrl: "https://aperdicao.blogspot.com", existing: false });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('Backend A PERDIÇÃO rodando');
});
