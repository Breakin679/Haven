/**
 * LocalSpots
 * Our own curated dataset (the "15+ real items" beyond the API). Shared by
 * the home page carousel and the search page — one dataset, one Spot
 * model, no duplication between them.
 */
const SERENITY_TAG = { high: 'quiet', medium: 'balanced', low: 'lively' };

class LocalSpots {
  static build() {
    const raw = [
      // --- Local (Lebanon) ---
      { name: 'Beiteddine Palace', country: 'Lebanon', code: 'LB · BEI', region: 'local', categories: ['wedding', 'honeymoon', 'couples'], price: 8500, priceUnit: 'event', rating: 4.9, serenity: 'high', atmosphere: 'historical', tags: ['heritage', 'architecture'], seed: 'beiteddine', description: 'A 19th-century Emiri palace with stone courtyards and cypress-lined terraces built for a grand entrance.' },
      { name: 'Batroun Seafront', country: 'Lebanon', code: 'LB · BAT', region: 'local', categories: ['wedding', 'vacation', 'couples'], price: 4200, priceUnit: 'event', rating: 4.7, serenity: 'medium', atmosphere: 'modern', tags: ['beachfront', 'nightlife'], seed: 'batroun', description: 'Sunset ceremonies on a private stretch of Mediterranean coastline, steps from the old souk.' },
      { name: 'Faraya Mountain Lodge', country: 'Lebanon', code: 'LB · FAR', region: 'local', categories: ['vacation', 'adventure', 'camping'], price: 90, priceUnit: 'night', rating: 4.6, serenity: 'high', atmosphere: 'rustic', tags: ['hiking', 'mountain'], seed: 'faraya', description: 'Ski-season chalets and summer hiking base camps in the heart of the Kesrouan range.' },
      { name: 'Byblos Old Port', country: 'Lebanon', code: 'LB · BYB', region: 'local', categories: ['wedding', 'vacation', 'couples'], price: 5200, priceUnit: 'event', rating: 4.8, serenity: 'medium', atmosphere: 'historical', tags: ['heritage', 'marina'], seed: 'byblos', description: 'One of the oldest continuously inhabited cities on earth, with a working marina as your backdrop.' },
      { name: 'Deir el Qamar Square', country: 'Lebanon', code: 'LB · DEQ', region: 'local', categories: ['wedding', 'couples'], price: 3800, priceUnit: 'event', rating: 4.7, serenity: 'medium', atmosphere: 'historical', tags: ['heritage', 'village'], seed: 'deirelqamar', description: 'A preserved 17th-century village square framed by red-tiled roofs and old sycamore trees.' },
      { name: 'Jeita Valley Retreat', country: 'Lebanon', code: 'LB · JEI', region: 'local', categories: ['vacation', 'camping', 'family'], price: 60, priceUnit: 'night', rating: 4.5, serenity: 'high', atmosphere: 'rustic', tags: ['camping', 'riverside'], seed: 'jeita', description: 'Riverside cabins minutes from the Jeita Grotto, built for slow mornings and long lunches.' },
      { name: 'Broumana Garden Terrace', country: 'Lebanon', code: 'LB · BRO', region: 'local', categories: ['wedding', 'couples'], price: 4600, priceUnit: 'event', rating: 4.6, serenity: 'medium', atmosphere: 'cozy', tags: ['garden', 'hillside'], seed: 'broumana', description: 'Hillside gardens overlooking the Beirut coastline, popular for spring and autumn ceremonies.' },
      { name: 'Anjar Ruins Backdrop', country: 'Lebanon', code: 'LB · ANJ', region: 'local', categories: ['vacation', 'adventure'], price: 45, priceUnit: 'night', rating: 4.4, serenity: 'medium', atmosphere: 'historical', tags: ['heritage', 'day-trip'], seed: 'anjar', description: 'Umayyad-era colonnades in the Bekaa Valley, ideal for history-driven day trips.' },
      { name: 'Tannourine Cedar Lodges', country: 'Lebanon', code: 'LB · TAN', region: 'local', categories: ['vacation', 'camping', 'adventure'], price: 75, priceUnit: 'night', rating: 4.6, serenity: 'high', atmosphere: 'rustic', tags: ['hiking', 'forest'], seed: 'tannourine', description: 'Cabins tucked inside one of Lebanon\u2019s last old-growth cedar reserves.' },
      { name: 'Chtaura Vineyard Estate', country: 'Lebanon', code: 'LB · CHT', region: 'local', categories: ['wedding', 'vacation', 'couples'], price: 3900, priceUnit: 'event', rating: 4.7, serenity: 'medium', atmosphere: 'rustic', tags: ['vineyard', 'countryside'], seed: 'chtaura', description: 'Bekaa Valley vines and a stone press house repurposed for weddings and wine weekends.' },

      // --- Global ---
      { name: 'Santorini Caldera Villas', country: 'Greece', code: 'GR · SAN', region: 'global', categories: ['wedding', 'honeymoon', 'couples'], price: 15000, priceUnit: 'event', rating: 4.9, serenity: 'medium', atmosphere: 'luxury', tags: ['iconic', 'sunset-views'], seed: 'santorini', description: 'Whitewashed cliffside villas overlooking the volcanic caldera, famous for their sunsets.' },
      { name: 'Ubud Rice Terrace Retreat', country: 'Bali, Indonesia', code: 'ID · UBD', region: 'global', categories: ['vacation', 'honeymoon', 'adventure'], price: 180, priceUnit: 'night', rating: 4.8, serenity: 'high', atmosphere: 'rustic', tags: ['wellness', 'jungle'], seed: 'ubud', description: 'Open-air villas set into the terraces, with rice-paddy views from every room.' },
      { name: 'Tuscan Vineyard Estate', country: 'Italy', code: 'IT · TUS', region: 'global', categories: ['wedding', 'couples'], price: 12000, priceUnit: 'event', rating: 4.8, serenity: 'high', atmosphere: 'rustic', tags: ['vineyard', 'countryside'], seed: 'tuscany', description: 'A working vineyard estate near Siena with a centuries-old stone barn for receptions.' },
      { name: 'Maldives Overwater Villas', country: 'Maldives', code: 'MV · MLE', region: 'global', categories: ['honeymoon', 'vacation', 'couples'], price: 650, priceUnit: 'night', rating: 4.9, serenity: 'high', atmosphere: 'luxury', tags: ['beachfront', 'snorkeling'], seed: 'maldives', description: 'Private overwater bungalows with direct lagoon access, built for barefoot ceremonies.' },
      { name: 'Lake Como Lakeside Villa', country: 'Italy', code: 'IT · COM', region: 'global', categories: ['wedding', 'honeymoon', 'couples'], price: 18000, priceUnit: 'event', rating: 4.9, serenity: 'high', atmosphere: 'luxury', tags: ['iconic', 'lakeside'], seed: 'lakecomo', description: 'A grand lakeside villa with formal gardens, favored for destination weddings since the 1800s.' },
      { name: 'Le Marais Courtyard', country: 'France', city: 'Paris', code: 'FR · PAR', region: 'global', categories: ['wedding', 'couples'], price: 9500, priceUnit: 'event', rating: 4.6, serenity: 'low', atmosphere: 'historical', tags: ['architecture', 'city'], seed: 'paris', description: 'An 18th-century h\u00f4tel particulier courtyard tucked away in central Paris.' },
      { name: 'Kyoto Temple Gardens', country: 'Japan', code: 'JP · KYO', region: 'global', categories: ['vacation', 'honeymoon'], price: 140, priceUnit: 'night', rating: 4.7, serenity: 'high', atmosphere: 'historical', tags: ['heritage', 'gardens'], seed: 'kyoto', description: 'Moss gardens and machiya guesthouses within walking distance of the Philosopher\u2019s Path.' },
      { name: 'Marrakech Riad Courtyard', country: 'Morocco', code: 'MA · MRK', region: 'global', categories: ['wedding', 'vacation', 'couples'], price: 6200, priceUnit: 'event', rating: 4.7, serenity: 'medium', atmosphere: 'cozy', tags: ['riad', 'medina'], seed: 'marrakech', description: 'A restored riad with a central fountain courtyard, hidden behind the medina walls.' },
    ];

    return raw.map((r, i) => new Spot({
      id: i + 1,
      name: r.name,
      city: r.city,
      country: r.country,
      code: r.code,
      region: r.region,
      category: r.categories[0],
      tags: [...r.categories.slice(1), SERENITY_TAG[r.serenity], r.atmosphere, ...r.tags],
      price: r.price,
      priceUnit: r.priceUnit,
      rating: r.rating,
      image: `https://picsum.photos/seed/${r.seed}/640/480`,
      description: r.description,
      source: 'local',
    }));
  }
}