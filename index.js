const express = require('express')
const cors = require('cors')
const sqlite3 = require('sqlite3').verbose()
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const path = require('path')

const app = express()
const PORT = 3002
const SECRET = 'cleanfix_secret_2025'

// Base de données
const db = new sqlite3.Database(path.join(__dirname, 'cleanfix.db'), (err) => {
  if (err) console.error('Erreur BD:', err)
  else console.log('📦 Base de données connectée')
})

// Créer les tables
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS utilisateurs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nom TEXT NOT NULL,
    telephone TEXT UNIQUE NOT NULL,
    mot_de_passe TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`)

  db.run(`CREATE TABLE IF NOT EXISTS prestations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    emoji TEXT,
    titre TEXT NOT NULL,
    prix INTEGER NOT NULL
  )`)

  db.run(`CREATE TABLE IF NOT EXISTS reservations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    utilisateur_id INTEGER,
    prestation TEXT NOT NULL,
    adresse TEXT NOT NULL,
    date TEXT,
    statut TEXT DEFAULT 'confirmée',
    prestataire TEXT DEFAULT 'Kouassi Bernard',
    eta TEXT DEFAULT '12 minutes',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`)

  // Insérer prestations si vide
  db.get('SELECT COUNT(*) as count FROM prestations', (err, row) => {
    if (row && row.count === 0) {
      db.run(`INSERT INTO prestations (emoji, titre, prix) VALUES ('🚿', 'Lavage extérieur', 3000)`)
      db.run(`INSERT INTO prestations (emoji, titre, prix) VALUES ('🪑', 'Sièges & Intérieur', 6000)`)
      db.run(`INSERT INTO prestations (emoji, titre, prix) VALUES ('✨', 'Polissage', 20000)`)
      db.run(`INSERT INTO prestations (emoji, titre, prix) VALUES ('🌿', 'Éco sans eau', 4000)`)
      console.log('✅ Prestations insérées')
    }
  })
})

// Middleware
app.use(cors())
app.use(express.json())

// ── ROUTES ──────────────────────────────────────

app.get('/', (req, res) => {
  res.json({ message: '🚗 CleanFix CI API — Serveur opérationnel !' })
})

// Inscription
app.post('/api/inscription', async (req, res) => {
  const { nom, telephone, mot_de_passe } = req.body
  if (!nom || !telephone || !mot_de_passe) {
    return res.status(400).json({ erreur: 'Tous les champs sont obligatoires' })
  }
  try {
    const hash = await bcrypt.hash(mot_de_passe, 10)
    db.run('INSERT INTO utilisateurs (nom, telephone, mot_de_passe) VALUES (?, ?, ?)',
      [nom, telephone, hash],
      function(err) {
        if (err) return res.status(400).json({ erreur: 'Ce numéro est déjà utilisé' })
        const token = jwt.sign({ id: this.lastID, nom, telephone }, SECRET, { expiresIn: '7d' })
        console.log(`✅ Nouvel utilisateur : ${nom}`)
        res.status(201).json({ token, utilisateur: { id: this.lastID, nom, telephone } })
      }
    )
  } catch (err) {
    res.status(500).json({ erreur: 'Erreur serveur' })
  }
})

// Connexion
app.post('/api/connexion', async (req, res) => {
  const { telephone, mot_de_passe } = req.body
  db.get('SELECT * FROM utilisateurs WHERE telephone = ?', [telephone], async (err, utilisateur) => {
    if (!utilisateur) return res.status(400).json({ erreur: 'Numéro introuvable' })
    const valide = await bcrypt.compare(mot_de_passe, utilisateur.mot_de_passe)
    if (!valide) return res.status(400).json({ erreur: 'Mot de passe incorrect' })
    const token = jwt.sign({ id: utilisateur.id, nom: utilisateur.nom, telephone }, SECRET, { expiresIn: '7d' })
    console.log(`✅ Connexion : ${utilisateur.nom}`)
    res.json({ token, utilisateur: { id: utilisateur.id, nom: utilisateur.nom, telephone } })
  })
})

// Prestations
app.get('/api/prestations', (req, res) => {
  db.all('SELECT * FROM prestations', (err, rows) => {
    res.json(rows)
  })
})

// Créer réservation
app.post('/api/reservations', (req, res) => {
  const { prestation, adresse, date } = req.body
  if (!prestation || !adresse) {
    return res.status(400).json({ erreur: 'Prestation et adresse obligatoires' })
  }
  db.run('INSERT INTO reservations (prestation, adresse, date) VALUES (?, ?, ?)',
    [prestation, adresse, date || "Aujourd'hui"],
    function(err) {
      if (err) return res.status(500).json({ erreur: 'Erreur serveur' })
      const reservation = {
        id: this.lastID,
        prestation, adresse,
        date: date || "Aujourd'hui",
        statut: 'confirmée',
        prestataire: 'Kouassi Bernard',
        eta: '12 minutes'
      }
      console.log('📋 Réservation enregistrée :', reservation)
      res.status(201).json(reservation)
    }
  )
})

// Récupérer réservations
app.get('/api/reservations', (req, res) => {
  db.all('SELECT * FROM reservations ORDER BY created_at DESC', (err, rows) => {
    res.json(rows || [])
  })
})

// ── DÉMARRAGE ────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅ Serveur CleanFix CI démarré sur http://localhost:${PORT}`)
})