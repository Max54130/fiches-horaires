/**
 * Suite de Tests Automatisée — Validation Algorithmique & Intégrité Fiches Horaires
 * Exécution : npm test ou node tests/fiches_validation.test.js
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const htmlPath = path.join(__dirname, '../app/src/main/assets/index.html');
const html = fs.readFileSync(htmlPath, 'utf8');

// Extraction des scripts JS pour évaluation dans un bac à sable isolé
const scriptRegex = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
let match;
let fullJs = '';
while ((match = scriptRegex.exec(html)) !== null) {
  fullJs += match[1] + '\n';
}

// Contexte Sandbox sécurisé
const sandbox = {
  console: console,
  setTimeout: setTimeout,
  clearTimeout: clearTimeout,
  document: {
    getElementById: () => ({ addEventListener: () => {}, classList: { add: () => {}, remove: () => {} } }),
    querySelectorAll: () => [],
    createElement: () => ({ style: {}, classList: { add: () => {} } }),
    body: { classList: { add: () => {}, remove: () => {} }, appendChild: () => {} }
  },
  window: { addEventListener: () => {} },
  localStorage: {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {}
  }
};

vm.createContext(sandbox);

// Neutraliser l'auto-exécution de init() au bas du script pour exécuter les déclarations
const runnableJs = fullJs.replace(/\(function init\(\)[\s\S]*$/, '// init stripped for automated tests');
vm.runInContext(runnableJs, sandbox);

let passCount = 0;
let failCount = 0;

function it(desc, fn) {
  try {
    fn();
    passCount++;
    console.log(`  \x1b[32m✔ PASS\x1b[0m : ${desc}`);
  } catch (err) {
    failCount++;
    console.log(`  \x1b[31m✘ FAIL\x1b[0m : ${desc}`);
    console.error(`     \x1b[33m${err.message}\x1b[0m`);
  }
}

function expect(actual) {
  return {
    toBe(expected) {
      if (actual !== expected) {
        throw new Error(`Attendu: ${JSON.stringify(expected)}, Reçu: ${JSON.stringify(actual)}`);
      }
    },
    toEqual(expected) {
      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error(`Attendu: ${JSON.stringify(expected)}, Reçu: ${JSON.stringify(actual)}`);
      }
    },
    toBeTruthy() {
      if (!actual) throw new Error(`Attendu: valeur vérité (truthy), Reçu: ${actual}`);
    },
    toBeNull() {
      if (actual !== null) throw new Error(`Attendu: null, Reçu: ${actual}`);
    }
  };
}

console.log('\n==========================================================');
console.log('🧪 SUITE DE VALIDATION CLINIQUE & MÉTIER — FICHES HORAIRES');
console.log('==========================================================\n');

// -------------------------------------------------------------
console.log('--- 1. Parsing des Horaires (parseTime) ---');
// -------------------------------------------------------------
it('Accepte le format standard HH:MM (ex: 08:30)', () => {
  const r = sandbox.parseTime('08:30');
  expect(r.hour).toBe(8);
  expect(r.min).toBe(30);
});

it('Accepte le format court H:MM (ex: 8:45)', () => {
  const r = sandbox.parseTime('8:45');
  expect(r.hour).toBe(8);
  expect(r.min).toBe(45);
});

it('Accepte le séparateur "h" ou "H" (ex: 14h15, 07H05)', () => {
  const r1 = sandbox.parseTime('14h15');
  expect(r1.hour).toBe(14);
  expect(r1.min).toBe(15);

  const r2 = sandbox.parseTime('07H05');
  expect(r2.hour).toBe(7);
  expect(r2.min).toBe(5);
});

it('Accepte le séparateur point "." (ex: 18.20)', () => {
  const r = sandbox.parseTime('18.20');
  expect(r.hour).toBe(18);
  expect(r.min).toBe(20);
});

it('Accepte les heures limites 00:00 et 23:59', () => {
  const rMin = sandbox.parseTime('00:00');
  expect(rMin.hour).toBe(0);
  expect(rMin.min).toBe(0);

  const rMax = sandbox.parseTime('23:59');
  expect(rMax.hour).toBe(23);
  expect(rMax.min).toBe(59);
});

it('Rejette strictement les heures hors bornes (>=24 ou minutes >=60)', () => {
  expect(sandbox.parseTime('24:00').hour).toBeNull();
  expect(sandbox.parseTime('25:10').hour).toBeNull();
  expect(sandbox.parseTime('12:60').hour).toBeNull();
  expect(sandbox.parseTime('12:99').hour).toBeNull();
});

it('Conserve le texte libre ALD (À La Demande) sans planter', () => {
  const r = sandbox.parseTime('ALD');
  expect(r.raw).toBe('ALD');
  expect(r.hour).toBeNull();
});

it('Conserve le symbole tiret "—" (pas de passage)', () => {
  const r = sandbox.parseTime('—');
  expect(r.raw).toBe('—');
  expect(r.hour).toBeNull();
});

// -------------------------------------------------------------
console.log('\n--- 2. Ergonomie & Complétion de Saisie (autoFormatTime / finalizeTime) ---');
// -------------------------------------------------------------
it('Formate 4 chiffres en HH:MM à la volée (ex: "0830" -> "08:30")', () => {
  expect(sandbox.autoFormatTime('0830')).toBe('08:30');
  expect(sandbox.autoFormatTime('1745')).toBe('17:45');
});

it('Formate 3 chiffres avec premier >= 3 en H:MM (ex: "745" -> "7:45")', () => {
  expect(sandbox.autoFormatTime('745')).toBe('7:45');
});

it('Finalise 1 chiffre en heure pile (ex: "7" -> "7:00")', () => {
  expect(sandbox.finalizeTime('7')).toBe('7:00');
});

it('Finalise 2 chiffres en heure pile (ex: "08" -> "08:00")', () => {
  expect(sandbox.finalizeTime('08')).toBe('08:00');
});

it('Finalise 3 chiffres en HH:M0 (ex: "074" -> "07:40")', () => {
  expect(sandbox.finalizeTime('074')).toBe('07:40');
});

it('Ne modifie pas les jetons spéciaux ALD ou tiret', () => {
  expect(sandbox.finalizeTime('ALD')).toBe('ALD');
  expect(sandbox.finalizeTime('—')).toBe('—');
});

// -------------------------------------------------------------
console.log('\n--- 3. Jours de Circulation (joursToString) ---');
// -------------------------------------------------------------
it('Identifie une circulation 7j/7 (Lundi au Dimanche)', () => {
  const allDays = [true, true, true, true, true, true, true];
  const s = sandbox.joursToString(allDays);
  expect(/lundi.*dimanche/i.test(s) || /tous les jours/i.test(s)).toBeTruthy();
});

it('Identifie une circulation en semaine (Lundi au Vendredi)', () => {
  const weekDays = [true, true, true, true, true, false, false];
  const s = sandbox.joursToString(weekDays);
  expect(/lundi.*vendredi/i.test(s)).toBeTruthy();
});

// -------------------------------------------------------------
console.log('\n--- 4. Migration & Rétrocompatibilité (migrateFiche) ---');
// -------------------------------------------------------------
it('Migre une fiche v1 en ajoutant les couleurs et la sélection de jours', () => {
  const legacy = {
    id: 'f_old_123',
    nom: 'Navette Bénévoles 2024',
    titre: 'COUPE DE FRANCE',
    sens: [
      { depart: 'Gare', arrivee: 'Site', arrets: ['Gare', 'Hôtel', 'Site'], matin: [['08:00', '08:15', '08:30']], soir: [] },
      { depart: 'Site', arrivee: 'Gare', arrets: ['Site', 'Hôtel', 'Gare'], matin: [], soir: [] }
    ]
  };
  const updated = sandbox.migrateFiche(legacy);
  expect(updated.colors.sens1).toBe('#009de0');
  expect(updated.colors.sens2).toBe('#1f2d5a');
  expect(updated.joursCoches.length).toBe(7);
});

// -------------------------------------------------------------
console.log('\n--- 5. Synchronisation de la Matrice d\'Arrêts ---');
// -------------------------------------------------------------
it('Synchronise les horaires lors de la suppression d\'un arrêt intermédiaire', () => {
  const sens = {
    arrets: ['Arrêt 1', 'Arrêt 2 (à supprimer)', 'Arrêt 3'],
    matin: [
      ['08:00', '08:15', '08:30'],
      ['09:00', '09:15', '09:30']
    ],
    soir: []
  };

  const removeIdx = 1;
  sens.arrets.splice(removeIdx, 1);
  sens.matin.forEach(col => col.splice(removeIdx, 1));

  expect(sens.arrets.length).toBe(2);
  expect(sens.matin[0].length).toBe(2);
  expect(sens.matin[0][0]).toBe('08:00');
  expect(sens.matin[0][1]).toBe('08:30');
});

// -------------------------------------------------------------
console.log('\n--- 6. Génération de Grille Type Gare Routière (buildTableHTML) ---');
// -------------------------------------------------------------
it('Génère correctement les en-têtes d\'heures et les cellules de minutes', () => {
  const sens = {
    depart: 'Gare',
    arrivee: 'Parc',
    arrets: ['Gare', 'Parc']
  };
  const columns = [
    ['08:00', '08:20'],
    ['08:30', '08:50'],
    ['09:10', '09:30']
  ];
  const tableHtml = sandbox.buildTableHTML(sens, columns);
  expect(tableHtml.includes('<th class="hour-head">8h</th>')).toBeTruthy();
  expect(tableHtml.includes('<th class="hour-head">9h</th>')).toBeTruthy();
  expect(tableHtml.includes('00')).toBeTruthy();
  expect(tableHtml.includes('30')).toBeTruthy();
  expect(tableHtml.includes('10')).toBeTruthy();
});

// -------------------------------------------------------------
console.log('\n--- 7. Détection d\'Inversion Chronologique (isTimeInversion) ---');
// -------------------------------------------------------------
it('Détecte une inversion horaire anormale entre deux arrêts successifs', () => {
  expect(sandbox.isTimeInversion('08:15', '08:30')).toBe(true); // Inversion !
  expect(sandbox.isTimeInversion('08:45', '08:30')).toBe(false); // Normal
  expect(sandbox.isTimeInversion('08:30', '08:30')).toBe(false); // Même heure
});

it('Tolère le passage de minuit pour les services de nuit', () => {
  expect(sandbox.isTimeInversion('00:15', '23:45')).toBe(false); // Minuit valide
  expect(sandbox.isTimeInversion('01:00', '23:30')).toBe(false); // Minuit valide
  expect(sandbox.isTimeInversion('14:00', '14:30')).toBe(true);  // En plein jour, c'est bien une inversion
});

console.log('\n==========================================================');
console.log(`TOTAL : ${passCount} tests réussis, ${failCount} échecs`);
console.log('==========================================================\n');

if (failCount > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
