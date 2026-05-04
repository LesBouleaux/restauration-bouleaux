 // ============================================================
// SHARED.JS - Restauration Les Bouleaux
// Configuration Supabase + utilitaires partagés
// ============================================================

// ===== CONFIGURATION SUPABASE =====
const SUPABASE_URL = 'https://pdrwhlbhfychkbedkhcz.supabase.co';
const SUPABASE_KEY = 'sb_publishable_-BKpAY6DCKAdRZ2ieVoHPA_ITXzptqf';
const supaClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ===== NOMS DES TABLES =====
const TABLE_RESIDENTS = 'résidents';
const TABLE_PRESENCES = 'presences';
const TABLE_PROFILS = 'profils_utilisateurs';
const TABLE_COMMANDES_EJC = 'commandes_ejc';
const TABLE_ANNULATIONS_EJC = 'annulations_ejc';
const TABLE_CATEGORIES_EJC = 'categories_ejc';

// ============================================================
// UTILITAIRES DATES
// ============================================================

function aujourdhui() {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

function dateFr(isoDate) {
    if (!isoDate) return '';
    const d = new Date(isoDate + 'T00:00:00');
    const jours = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
    const mois = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
    return `${jours[d.getDay()]} ${d.getDate()} ${mois[d.getMonth()]} ${d.getFullYear()}`;
}

function libelleRepas(code) {
    const map = {
        'petit_dej': '🥐 Petit-déjeuner',
        'dejeuner': '🍽️ Déjeuner',
        'diner': '🌙 Dîner'
    };
    return map[code] || code;
}

// ============================================================
// SEMAINE EJC (lundi, jours ouvrés, verrouillage)
// ============================================================

function lundiDeLaSemaine(date) {
    const d = new Date(date);
    const jour = d.getDay();
    const diff = jour === 0 ? -6 : 1 - jour;
    d.setDate(d.getDate() + diff);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

function joursOuvres(lundiIso) {
    const result = [];
    const d = new Date(lundiIso + 'T00:00:00');
    for (let i = 0; i < 5; i++) {
        const dd = new Date(d);
        dd.setDate(d.getDate() + i);
        const yyyy = dd.getFullYear();
        const mm = String(dd.getMonth() + 1).padStart(2, '0');
        const day = String(dd.getDate()).padStart(2, '0');
        result.push(`${yyyy}-${mm}-${day}`);
    }
    return result;
}

function commandeOuverte(lundiSemaineConcernee) {
    const lundi = new Date(lundiSemaineConcernee + 'T00:00:00');
    const limite = new Date(lundi);
    limite.setDate(lundi.getDate() - 6);
    limite.setHours(12, 0, 0, 0);
    return new Date() < limite;
}

function annulationOuverte(dateIso) {
    const d = new Date(dateIso + 'T08:00:00');
    return new Date() < d;
}

// ============================================================
// AUTH - Vérification connexion + rôle
// ============================================================

async function verifierAuthEtRole(rolesAutorises) {
    const { data: { session } } = await supaClient.auth.getSession();
    if (!session) {
        window.location.href = 'login.html';
        return null;
    }

    const { data: profil, error } = await supaClient
        .from(TABLE_PROFILS)
        .select('*')
        .eq('user_id', session.user.id)
        .maybeSingle();

    if (error || !profil) {
        alert('Profil utilisateur introuvable. Contactez l\'administrateur.');
        await supaClient.auth.signOut();
        window.location.href = 'login.html';
        return null;
    }

    if (rolesAutorises && rolesAutorises.length && !rolesAutorises.includes(profil.role)) {
        alert('⛔ Vous n\'avez pas accès à cette page.');
        if (profil.role === 'admin') window.location.href = 'dashboard.html';
        else if (profil.role === 'client_ejc') window.location.href = 'commande-ejc.html';
        else window.location.href = 'login.html';
        return null;
    }

    return { user: session.user, profil };
}

async function deconnexion() {
    await supaClient.auth.signOut();
    window.location.href = 'login.html';
}

// ============================================================
// PROFIL UTILISATEUR (utilisé par login.html)
// ============================================================

async function chargerProfil(userId) {
    const { data, error } = await supaClient
        .from(TABLE_PROFILS)
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
    if (error) {
        console.error('Erreur chargement profil :', error);
        return null;
    }
    return data;
}

// ============================================================
// EN-TÊTE AVEC LOGO
// ============================================================

function afficherEntete() {
    const entete = document.getElementById('app-header');
    if (entete) {
        entete.innerHTML = `<img src="images/logo.png" alt="Restauration Les Bouleaux" class="logo">`;
    }
}

// ============================================================
// MENU & ENTÊTE
// ============================================================

function genererMenuOnglets(pageActive, role) {
    const ongletsAdmin = [
        { id: 'dashboard', titre: '🏠 Accueil', url: 'dashboard.html' },
        { id: 'residents', titre: '👥 Résidents', url: 'residents.html' },
        { id: 'presences', titre: '✅ Présences', url: 'presences.html' },
        { id: 'production', titre: '📋 Production J-1', url: 'production.html' },
        { id: 'service', titre: '🍽️ Service du jour', url: 'service.html' },
        { id: 'recap-ejc', titre: '🍴 EJC Péry', url: 'recap-ejc.html' },
        { id: 'categories-ejc', titre: '🏷️ Catégories EJC', url: 'categories-ejc.html' },
        { id: 'factures-admin', titre: '🧾 Factures EJC', url: 'factures-admin.html' },
        { id: 'stats', titre: '📊 Statistiques', url: 'stats.html' }
    ];

    const ongletsEjc = [
        { id: 'dashboard', titre: '🏠 Accueil', url: 'dashboard.html' },
        { id: 'commande-ejc', titre: '🍽️ Saisie repas', url: 'commande-ejc.html' },
        { id: 'factures-ejc', titre: '🧾 Mes factures', url: 'factures-ejc.html' }
    ];

    const onglets = role === 'client_ejc' ? ongletsEjc : ongletsAdmin;

    let html = '<div class="menu-onglets">';
    for (const o of onglets) {
        const cls = o.id === pageActive ? 'active' : '';
        html += `<a href="${o.url}" class="onglet ${cls}">${o.titre}</a>`;
    }
    html += '</div>';
    return html;
}

function afficherMenu(pageActive) {
    afficherEntete();
    const menu = document.getElementById('menu');
    if (menu) menu.innerHTML = genererMenuOnglets(pageActive, 'admin');
}

function afficherMenuComplet(pageActive, emailUtilisateur, role, nomAffiche) {
    afficherEntete();
    const menu = document.getElementById('menu');
    if (!menu) return;
    let html = genererMenuOnglets(pageActive, role);
    html += `<div class="user-bar">
        <span>Connecté : <strong>${nomAffiche || emailUtilisateur}</strong></span>
        <button class="btn-danger btn-small" onclick="deconnexion()">🚪 Déconnexion</button>
    </div>`;
    menu.innerHTML = html;
}

// ============================================================
// RÉSIDENTS - Chargement
// ============================================================

async function chargerResidentsActifs() {
    const { data, error } = await supaClient
        .from(TABLE_RESIDENTS)
        .select('*')
        .eq('actif', true)
        .order('prenom', { ascending: true });
    if (error) {
        console.error('Erreur chargement résidents :', error);
        return [];
    }
    return data || [];
}

// ============================================================
// CATÉGORIES EJC - Chargement
// ============================================================

async function chargerCategoriesEjc(uniquementActives = true) {
    let query = supaClient
        .from(TABLE_CATEGORIES_EJC)
        .select('*')
        .order('ordre', { ascending: true })
        .order('nom', { ascending: true });
    if (uniquementActives) query = query.eq('actif', true);

    const { data, error } = await query;
    if (error) {
        console.error('Erreur chargement catégories EJC :', error);
        return [];
    }
    return data || [];
}

// Liste des 14 allergènes majeurs (réutilisable partout)
const ALLERGENES_LISTE = [
    { code: 'gluten',         nom: 'Gluten',           emoji: '🌾' },
    { code: 'crustaces',      nom: 'Crustacés',        emoji: '🦐' },
    { code: 'oeufs',          nom: 'Œufs',             emoji: '🥚' },
    { code: 'poissons',       nom: 'Poissons',         emoji: '🐟' },
    { code: 'arachides',      nom: 'Arachides',        emoji: '🥜' },
    { code: 'soja',           nom: 'Soja',             emoji: '🌱' },
    { code: 'lait',           nom: 'Lait',             emoji: '🥛' },
    { code: 'fruits_a_coque', nom: 'Fruits à coque',   emoji: '🌰' },
    { code: 'celeri',         nom: 'Céleri',           emoji: '🥬' },
    { code: 'moutarde',       nom: 'Moutarde',         emoji: '🟡' },
    { code: 'sesame',         nom: 'Graines de sésame',emoji: '🌻' },
    { code: 'sulfites',       nom: 'Sulfites',         emoji: '🧪' },
    { code: 'lupin',          nom: 'Lupin',            emoji: '🌿' },
    { code: 'mollusques',     nom: 'Mollusques',       emoji: '🦪' }
];

function nomAllergene(code) {
    const a = ALLERGENES_LISTE.find(x => x.code === code);
    return a ? `${a.emoji} ${a.nom}` : code;
}