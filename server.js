app.post('/api/search', async (req, res) => {
  try {
    const { query, latitude, longitude } = req.body;
    let url = '';

    if (latitude && longitude) {
      // Busca num raio de 50km (GPS)
      url = `https://api.geoapify.com/v2/places?categories=entertainment,adult,nightclub&filter=circle:${longitude},${latitude},50000&limit=10&apiKey=${process.env.GEOAPIFY_API_KEY}`;
    } else if (query) {
      // Busca exatamente o que o usuário digitou (sem forçar palavras)
      const termo = encodeURIComponent(query);
      url = `https://api.geoapify.com/v2/places?text=${termo}&filter=rect:-74.0,-33.0,-34.0,5.0&limit=10&apiKey=${process.env.GEOAPIFY_API_KEY}`;
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
