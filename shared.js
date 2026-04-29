// ===== CONFIGURATION SUPABASE PARTAGÉE =====
const SUPABASE_URL = 'https://pdrwhlbhfychkbedkhcz.supabase.co';
const SUPABASE_KEY = 'sb_publishable_-BKpAY6DCKAdRZ2ieVoHPA_ITXzptqf';
const supaClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ===== TABLES =====
const TABLE_RESIDENTS = 'résidents';
const TABLE_PRESENCES = 'presences';

// ===== UTILITAIRES =====

// Formater une date au format YYYY-MM-DD (pour Supabase)
function dateISO(date) {
    const d = date instanceof Date ? date : new Date(date);
    const annee = d.getFullYear();
    const mois = String(d.getMonth() + 1).padStart(2, '0');
    const jour = String(d.getDate()).padStart(2, '0');
    return `${annee}-${mois}-${jour}`;
}

// Date d'aujourd'hui au format YYYY-MM-DD
function aujourdhui() {
    return dateISO(new Date());
}

// Date de demain
function demain() {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return dateISO(d);
}

// Formater une date pour l'affichage en français
function dateFr(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('fr-FR', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });
}

// Libellé d'un repas
function libelleRepas(code) {
    const libelles = {
        'petit_dej': '🥐 Petit-déjeuner',
        'dejeuner': '🍽️ Déjeuner',
        'diner': '🌙 Dîner'
    };
    return libelles[code] || code;
}

// Charger la liste des résidents actifs (utilisé partout)
async function chargerResidentsActifs() {
    const { data, error } = await supaClient
        .from(TABLE_RESIDENTS)
        .select('*')
        .eq('actif', true)
        .order('nom');
    if (error) {
        console.error('Erreur chargement résidents:', error);
        return [];
    }
    return data || [];
}

// Construit le HTML du menu d'onglets, avec l'onglet courant actif
function genererMenuOnglets(pageActive) {
    const onglets = [
        { id: 'residents',   fichier: 'residents.html',  label: '👥 Résidents' },
        { id: 'presences',   fichier: 'presences.html',  label: '📋 Présences' },
        { id: 'production',  fichier: 'production.html', label: '📄 Production J-1' },
        { id: 'service',     fichier: 'service.html',    label: '🍽️ Service du jour' }
    ];
    let html = '<nav class="tabs">';
    for (const o of onglets) {
        const cls = (o.id === pageActive) ? 'tab active' : 'tab';
        html += `<a href="${o.fichier}" class="${cls}">${o.label}</a>`;
    }
    html += '</nav>';
    return html;
}

// Insère le menu en haut de la page (à appeler dans chaque page)
function afficherMenu(pageActive) {
    const menu = document.getElementById('menu');
    if (menu) menu.innerHTML = genererMenuOnglets(pageActive);
}