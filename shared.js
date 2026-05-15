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
const TABLE_CLIENTS = 'clients';

// ===== CONTEXTE GLOBAL DE L'UTILISATEUR CONNECTÉ =====
let CONTEXTE_CLIENT = null;

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

// ⚠️ Versions legacy (valeurs en dur) — conservées pour compatibilité
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
// SEMAINE EJC - VERSIONS PARAMÉTRABLES PAR CLIENT
// ============================================================

function calculerDeadlineCommande(lundiSemaineConcernee, client) {
    const dlJour = client?.deadline_jour ?? 2;
    const dlHeure = client?.deadline_heure ?? 12;
    const lundi = new Date(lundiSemaineConcernee + 'T00:00:00');
    const lundiSemPrecedente = new Date(lundi);
    lundiSemPrecedente.setDate(lundi.getDate() - 7);
    const deadline = new Date(lundiSemPrecedente);
    const decalage = (dlJour - 1 + 7) % 7;
    deadline.setDate(lundiSemPrecedente.getDate() + decalage);
    deadline.setHours(dlHeure, 0, 0, 0);
    return deadline;
}

function commandeOuverteClient(lundiSemaineConcernee, client) {
    return new Date() < calculerDeadlineCommande(lundiSemaineConcernee, client);
}

function annulationOuverteClient(dateIso, client) {
    const heureLimite = client?.deadline_annulation_heure ?? 8;
    const d = new Date(dateIso + 'T00:00:00');
    d.setHours(heureLimite, 0, 0, 0);
    return new Date() < d;
}

function getReglesClient(client) {
    const jours = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
    return {
        deadlineJour: client?.deadline_jour ?? 2,
        deadlineJourLibelle: jours[client?.deadline_jour ?? 2],
        deadlineHeure: client?.deadline_heure ?? 12,
        deadlineAnnulationHeure: client?.deadline_annulation_heure ?? 8,
        pctAnnulationJourJ: client?.pct_annulation_jour_j ?? 50
    };
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

// ============================================================
// CONTEXTE CLIENT - chargement enrichi (multi-clients)
// ============================================================

async function chargerContexteClient(rolesAutorises) {
    const auth = await verifierAuthEtRole(rolesAutorises);
    if (!auth) return null;

    let client = null;
    if (auth.profil.client_id) {
        const { data, error } = await supaClient
            .from(TABLE_CLIENTS)
            .select('*')
            .eq('id', auth.profil.client_id)
            .maybeSingle();
        if (error) {
            console.error('Erreur chargement client :', error);
        } else {
            client = data;
        }
    }

    CONTEXTE_CLIENT = {
        user: auth.user,
        profil: auth.profil,
        client: client
    };
    return CONTEXTE_CLIENT;
}

function getClientCourant() {
    return CONTEXTE_CLIENT?.client || null;
}

async function chargerTousLesClients(uniquementActifs = true) {
    let query = supaClient
        .from(TABLE_CLIENTS)
        .select('*')
        .order('nom', { ascending: true });
    if (uniquementActifs) query = query.eq('actif', true);

    const { data, error } = await query;
    if (error) {
        console.error('Erreur chargement clients :', error);
        return [];
    }
    return data || [];
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
        { id: 'dashboard',              titre: '🏠 Accueil',               url: 'dashboard.html' },
        { id: 'residents-bouleaux',     titre: '👥 Résidents Bouleaux',    url: 'residents-bouleaux.html' },
        { id: 'residents-passerelle',   titre: '🌉 Résidents Passerelle',  url: 'residents-passerelle.html' },
        { id: 'residents-sortis',       titre: '📤 Résidents sortis',      url: 'residents-sortis.html' },
        { id: 'presences-bouleaux',     titre: '✅ Présences Bouleaux',    url: 'presences-bouleaux.html' },
        { id: 'presences-passerelle',   titre: '✅ Présences Passerelle',  url: 'presences-passerelle.html' },
        { id: 'production',             titre: '📋 Production J-1',        url: 'production.html' },
        { id: 'service',                titre: '🍽️ Service du jour',       url: 'service.html' },
        { id: 'commande-ejc',           titre: '📝 Commandes externes',    url: 'commande-ejc.html' },
        { id: 'personnes-appartement',  titre: '🏨 Personnes appartement', url: 'personnes-appartement.html' },
        { id: 'sejours-appartement',    titre: '📅 Séjours appartement',   url: 'sejours-appartement.html' },
        { id: 'presences-appartement',  titre: '✅ Présences appartement', url: 'presences-appartement.html' },
        { id: 'repas-domicile',         titre: '🏠 Repas à domicile',      url: 'repas-domicile.html' },
        { id: 'presences-domicile',     titre: '🗓️ Présences domicile',    url: 'presences-domicile.html' },
        { id: 'recap-clients',          titre: '📊 Récap clients',         url: 'recap-clients.html' },
        { id: 'recap-domicile',         titre: '📊 Récap domicile',        url: 'recap-domicile.html' },
        { id: 'categories-clients',     titre: '🏷️ Catégories clients',    url: 'categories-clients.html' },
        { id: 'factures-clients-admin', titre: '🧾 Factures clients',      url: 'factures-clients-admin.html' },
        { id: 'stats',                  titre: '📊 Statistiques',          url: 'stats.html' },
        { id: 'parametres',             titre: '⚙️ Paramètres',            url: 'parametres.html' }
    ];

    const ongletsEjc = [
        { id: 'dashboard',    titre: '🏠 Accueil',       url: 'dashboard.html' },
        { id: 'commande-ejc', titre: '🍽️ Saisie repas',  url: 'commande-ejc.html' },
        { id: 'factures-ejc', titre: '🧾 Mes factures',  url: 'factures-ejc.html' }
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
// UNITÉS D'HÉBERGEMENT (Bouleaux / Passerelle) ⭐ NOUVEAU
// ============================================================

const UNITES_LISTE = [
    { code: 'bouleaux',   nom: 'Bouleaux',   emoji: '🏠' },
    { code: 'passerelle', nom: 'Passerelle', emoji: '🌉' }
];

function nomUnite(code) {
    const u = UNITES_LISTE.find(x => x.code === code);
    return u ? `${u.emoji} ${u.nom}` : code;
}

function nomUniteSansEmoji(code) {
    const u = UNITES_LISTE.find(x => x.code === code);
    return u ? u.nom : code;
}

// ============================================================
// TEXTURES MODIFIÉES ⭐ NOUVEAU
// ============================================================

const TEXTURE_DEFAUT = 'normale';

const TEXTURES_LISTE = [
    { code: 'normale',      nom: 'Normale',      emoji: '🍽️' },
    { code: 'mixe_lisse',   nom: 'Mixé lisse',   emoji: '🥣' },
    { code: 'coupe',        nom: 'Coupé',        emoji: '🔪' },
    { code: 'viande_mixe',  nom: 'Viande mixée', emoji: '🥩' },
    { code: 'liquide',      nom: 'Liquide',      emoji: '🥤' },
    { code: 'mixe_sucre',   nom: 'Mixé sucré',   emoji: '🍮' }
];

function nomTexture(code) {
    const t = TEXTURES_LISTE.find(x => x.code === code);
    return t ? `${t.emoji} ${t.nom}` : code;
}

function nomTextureSansEmoji(code) {
    const t = TEXTURES_LISTE.find(x => x.code === code);
    return t ? t.nom : code;
}

// Récupère la texture par défaut d'un résident pour un repas donné
function getTextureDefautResident(resident, repas) {
    if (!resident) return TEXTURE_DEFAUT;
    switch (repas) {
        case 'petit_dej': return resident.texture_defaut_petit_dej || TEXTURE_DEFAUT;
        case 'dejeuner':  return resident.texture_defaut_dejeuner  || TEXTURE_DEFAUT;
        case 'diner':     return resident.texture_defaut_diner     || TEXTURE_DEFAUT;
        default:          return TEXTURE_DEFAUT;
    }
}

// Génère un <select> HTML pour choisir une texture
function selectTextureHtml(nomChamp, valeurSelectionnee = TEXTURE_DEFAUT, attributs = '') {
    let html = `<select name="${nomChamp}" ${attributs}>`;
    for (const t of TEXTURES_LISTE) {
        const sel = t.code === valeurSelectionnee ? 'selected' : '';
        html += `<option value="${t.code}" ${sel}>${t.emoji} ${t.nom}</option>`;
    }
    html += '</select>';
    return html;
}

// ============================================================
// RÉSIDENTS - Chargement
// ============================================================

// Chargement de tous les résidents actifs (toutes unités confondues)
async function chargerResidentsActifs(unite = null) {
    let query = supaClient
        .from(TABLE_RESIDENTS)
        .select('*')
        .eq('actif', true)
        .order('prenom', { ascending: true });
    if (unite) query = query.eq('unite', unite);

    const { data, error } = await query;
    if (error) {
        console.error('Erreur chargement résidents :', error);
        return [];
    }
    return data || [];
}

// Helper rétro-compatible : charge UNIQUEMENT les résidents d'une unité
async function chargerResidentsParUnite(unite) {
    return chargerResidentsActifs(unite);
}

// ============================================================
// CATÉGORIES EJC - Chargement
// ============================================================

async function chargerCategoriesEjc(uniquementActives = true, clientId = null) {
    let query = supaClient
        .from(TABLE_CATEGORIES_EJC)
        .select('*')
        .order('ordre', { ascending: true })
        .order('nom', { ascending: true });
    if (uniquementActives) query = query.eq('actif', true);
    if (clientId) query = query.eq('client_id', clientId);

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

// ============================================================
// ABSENCES PROLONGÉES
// ============================================================

const TABLE_ABSENCES = 'absences_prolongees';

async function chargerAbsencesPourDate(dateIso) {
    const { data, error } = await supaClient
        .from(TABLE_ABSENCES)
        .select('*')
        .lte('date_debut', dateIso)
        .gte('date_fin', dateIso);
    if (error) {
        console.error('Erreur chargement absences :', error);
        return [];
    }
    return data || [];
}

async function chargerAbsencesPeriode(date1, date2) {
    const { data, error } = await supaClient
        .from(TABLE_ABSENCES)
        .select('*')
        .lte('date_debut', date2)
        .gte('date_fin', date1);
    if (error) {
        console.error('Erreur chargement absences :', error);
        return [];
    }
    return data || [];
}

function indexerAbsencesPourDateRepas(absences, dateIso, repas) {
    const map = {};
    for (const a of (absences || [])) {
        if (dateIso < a.date_debut || dateIso > a.date_fin) continue;
        const repasConcernes = a.repas_concernes || ['petit_dej', 'dejeuner', 'diner'];
        if (!repasConcernes.includes(repas)) continue;
        if (!map[a.resident_id]) map[a.resident_id] = a;
    }
    return map;
}

function estEnAbsenceProlongee(absences, residentId, dateIso, repas) {
    for (const a of (absences || [])) {
        if (a.resident_id !== residentId) continue;
        if (dateIso < a.date_debut || dateIso > a.date_fin) continue;
        const repasConcernes = a.repas_concernes || ['petit_dej', 'dejeuner', 'diner'];
        if (!repasConcernes.includes(repas)) continue;
        return a;
    }
    return null;
}