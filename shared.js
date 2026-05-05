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
// Rempli par chargerContexteClient() au démarrage de chaque page
// { user: {...}, profil: {...}, client: {...} | null }
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

// ⚠️ Version legacy (valeurs en dur : mardi 12h S-1)
// Conservée pour compatibilité avec d'éventuels appels existants.
// Préférer commandeOuverteClient() pour le multi-clients.
function commandeOuverte(lundiSemaineConcernee) {
    const lundi = new Date(lundiSemaineConcernee + 'T00:00:00');
    const limite = new Date(lundi);
    limite.setDate(lundi.getDate() - 6);
    limite.setHours(12, 0, 0, 0);
    return new Date() < limite;
}

// ⚠️ Version legacy (valeurs en dur : jour J 8h)
function annulationOuverte(dateIso) {
    const d = new Date(dateIso + 'T08:00:00');
    return new Date() < d;
}

// ============================================================
// SEMAINE EJC - VERSIONS PARAMÉTRABLES PAR CLIENT
// ============================================================

// Calcule la deadline de commande pour la semaine donnée, selon les règles du client
// client : objet { deadline_jour, deadline_heure } (0=dim, 1=lun, 2=mar, ...)
// Par défaut : mardi 12h de la semaine S-1 (= 6 jours avant le lundi de la semaine concernée)
function calculerDeadlineCommande(lundiSemaineConcernee, client) {
    const dlJour = client?.deadline_jour ?? 2;       // mardi
    const dlHeure = client?.deadline_heure ?? 12;    // 12h
    const lundi = new Date(lundiSemaineConcernee + 'T00:00:00');
    // On part du lundi de la semaine concernée, on remonte d'une semaine, puis on positionne sur le bon jour
    const lundiSemPrecedente = new Date(lundi);
    lundiSemPrecedente.setDate(lundi.getDate() - 7);
    const deadline = new Date(lundiSemPrecedente);
    // dlJour : 0=dim, 1=lun, 2=mar... → décalage depuis lundi (=1) : (dlJour - 1 + 7) % 7
    const decalage = (dlJour - 1 + 7) % 7;
    deadline.setDate(lundiSemPrecedente.getDate() + decalage);
    deadline.setHours(dlHeure, 0, 0, 0);
    return deadline;
}

// Version multi-clients : la commande est-elle encore ouverte ?
function commandeOuverteClient(lundiSemaineConcernee, client) {
    return new Date() < calculerDeadlineCommande(lundiSemaineConcernee, client);
}

// Version multi-clients : l'annulation est-elle encore ouverte ?
// client : objet { deadline_annulation_heure }
function annulationOuverteClient(dateIso, client) {
    const heureLimite = client?.deadline_annulation_heure ?? 8;
    const d = new Date(dateIso + 'T00:00:00');
    d.setHours(heureLimite, 0, 0, 0);
    return new Date() < d;
}

// Renvoie un objet règles formatées (pour l'affichage)
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
// Version enrichie de verifierAuthEtRole : charge en plus le client lié
// et remplit la variable globale CONTEXTE_CLIENT.
//
// Utilisation type en début de page :
//     const ctx = await chargerContexteClient(['client_ejc']);
//     if (!ctx) return; // redirection déjà faite
//     // ctx.user, ctx.profil, ctx.client
//     // ou via la globale CONTEXTE_CLIENT
//
// Pour un admin : ctx.client vaut null (l'admin n'est pas lié à un client unique)

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

// Renvoie le client courant (raccourci)
function getClientCourant() {
    return CONTEXTE_CLIENT?.client || null;
}

// Charge tous les clients (pour les sélecteurs admin)
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
// ⚠️ Multi-clients :
// - Si un clientId est passé : filtre par ce client.
// - Sinon, RLS fait le filtrage automatique :
//   * client_ejc → ne voit QUE les catégories de son client
//   * admin      → voit toutes les catégories de tous les clients
// Pour les pages admin avec sélecteur, passer explicitement le clientId.

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

// Charge les absences prolongées qui couvrent la date donnée
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

// Charge les absences prolongées qui chevauchent une période [date1, date2]
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

// À partir des absences chargées, retourne un Map { resident_id => absence }
// pour une date et un repas donnés. Une absence ne s'applique que si :
// - la date est dans la plage [date_debut, date_fin]
// - le repas est dans repas_concernes
function indexerAbsencesPourDateRepas(absences, dateIso, repas) {
    const map = {};
    for (const a of (absences || [])) {
        if (dateIso < a.date_debut || dateIso > a.date_fin) continue;
        const repasConcernes = a.repas_concernes || ['petit_dej', 'dejeuner', 'diner'];
        if (!repasConcernes.includes(repas)) continue;
        // Si plusieurs absences pour le même résident, on prend la 1re
        if (!map[a.resident_id]) map[a.resident_id] = a;
    }
    return map;
}

// Détermine si un résident est en absence prolongée pour (date, repas)
// Retourne l'objet absence si oui, null sinon
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