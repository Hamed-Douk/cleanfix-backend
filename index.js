const express = require('express')
const cors = require('cors')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { Pool } = require('pg')

const app = express()
const PORT = process.env.PORT || 3002
const SECRET = 'cleanfix_secret_2025'

// Connexion PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://cleanfix_db_user:8V7d1GFfNJCKKRN4BEUdgGLONTOrFE86@dpg-d942vchkh4rs73ec2fg0-a/cleanfix_db',
  ssl: { rejectUnauthorized: false }
})

// Créer les tables
const initDB = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS utilisateurs (
      id SERIAL PRIMARY KEY,
      nom TEXT NOT NULL,
      telephone TEXT UNIQUE NOT NULL,
      mot_de_passe TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS prestations (
      id SERIAL PRIMARY KEY,
      emoji TEXT,
      titre TEXT NOT NULL,
      prix INTEGER NOT NULL
    )
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS reservations (
      id SERIAL PRIMARY KEY,
      utilisateur_id INTEGER,
      prestation TEXT NOT NULL,
      adresse TEXT NOT NULL,
      date TEXT,
      statut TEXT DEFAULT 'confirmée',
      prestataire TEXT DEFAULT 'Kouassi Bernard',
      eta TEXT DEFAULT '12 minutes',
      created_at TIMESTAMP DEFAULT NOW()
    )
  `)

  // Insérer prestations si vide
  const { rows } = await pool.query('SELECT COUNT(*) as count FROM prestations')
  if (parseInt(rows[0].count) === 0) {
    await pool.query(`INSERT INTO prestations (emoji, titre, prix) VALUES
      ('🚿', 'Lavage extérieur', 3000),
      ('🪑', 'Sièges & Intérieur', 6000),
      ('✨', 'Polissage', 20000),
      ('🌿', 'Éco sans eau', 4000)
    `)
    console.log('✅ Prestations insérées')
  }
  console.log('✅ Base de données PostgreSQL initialisée')
}

initDB().catch(console.error)

app.use(cors())
app.use(express.json())

// Test
app.get('/', (req, res) => {
  res.json({ message: '🚗 CleanFix CI API — Serveur opérationnel !' })
})

// Prestations
app.get('/api/prestations', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM prestations')
  res.json(rows)
})

// Inscription
app.post('/api/inscription', async (req, res) => {
  const { nom, telephone, mot_de_passe } = req.body
  if (!nom || !telephone || !mot_de_passe) {
    return res.status(400).json({ erreur: 'Tous les champs sont obligatoires' })
  }
  try {
    const hash = await bcrypt.hash(mot_de_passe, 10)
    const { rows } = await pool.query(
      'INSERT INTO utilisateurs (nom, telephone, mot_de_passe) VALUES ($1, $2, $3) RETURNING id, nom, telephone',
      [nom, telephone, hash]
    )
    const utilisateur = rows[0]
    const token = jwt.sign({ id: utilisateur.id, nom: utilisateur.nom, telephone }, SECRET, { expiresIn: '7d' })
    console.log(`✅ Nouvel utilisateur : ${nom}`)
    res.status(201).json({ token, utilisateur })
  } catch (err) {
    res.status(400).json({ erreur: 'Ce numéro est déjà utilisé' })
  }
})

// Connexion
app.post('/api/connexion', async (req, res) => {
  const { telephone, mot_de_passe } = req.body
  const { rows } = await pool.query('SELECT * FROM utilisateurs WHERE telephone = $1', [telephone])
  if (rows.length === 0) return res.status(400).json({ erreur: 'Numéro introuvable' })
  const utilisateur = rows[0]
  const valide = await bcrypt.compare(mot_de_passe, utilisateur.mot_de_passe)
  if (!valide) return res.status(400).json({ erreur: 'Mot de passe incorrect' })
  const token = jwt.sign({ id: utilisateur.id, nom: utilisateur.nom, telephone }, SECRET, { expiresIn: '7d' })
  console.log(`✅ Connexion : ${utilisateur.nom}`)
  res.json({ token, utilisateur: { id: utilisateur.id, nom: utilisateur.nom, telephone } })
})

// Créer réservation
app.post('/api/reservations', async (req, res) => {
  const { prestation, adresse, date, utilisateur_id } = req.body
  if (!prestation || !adresse) {
    return res.status(400).json({ erreur: 'Prestation et adresse obligatoires' })
  }
  const { rows } = await pool.query(
    'INSERT INTO reservations (utilisateur_id, prestation, adresse, date) VALUES ($1, $2, $3, $4) RETURNING *',
[utilisateur_id || null, prestation, adresse, date || "Aujourd'hui"]
  )
  const reservation = {
    ...rows[0],
    prestataire: 'Kouassi Bernard',
    eta: '12 minutes'
  }
  console.log('📋 Réservation enregistrée :', reservation)
  res.status(201).json(reservation)
})

// Récupérer réservations
app.get('/api/reservations', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM reservations ORDER BY created_at DESC')
  res.json(rows)
})
// Dashboard admin — statistiques
app.get('/api/admin/stats', async (req, res) => {
  const reservations = await pool.query('SELECT COUNT(*) as total FROM reservations')
  const utilisateurs = await pool.query('SELECT COUNT(*) as total FROM utilisateurs')
  const aujourdhui = await pool.query(`
    SELECT COUNT(*) as total FROM reservations 
    WHERE DATE(created_at) = CURRENT_DATE
  `)
  const dernieres = await pool.query(`
    SELECT * FROM reservations 
    ORDER BY created_at DESC 
    LIMIT 10
  `)
  res.json({
    total_reservations: parseInt(reservations.rows[0].total),
    total_utilisateurs: parseInt(utilisateurs.rows[0].total),
    reservations_aujourdhui: parseInt(aujourdhui.rows[0].total),
    dernieres_reservations: dernieres.rows
  })
})
// Réservations d'un utilisateur spécifique
app.get('/api/reservations/user/:id', async (req, res) => {
  const { id } = req.params
  const { rows } = await pool.query(
    'SELECT * FROM reservations WHERE utilisateur_id = $1 ORDER BY created_at DESC',
    [id]
  )
  res.json(rows)
})
app.listen(PORT, () => {
  console.log(`✅ Serveur CleanFix CI démarré sur http://localhost:${PORT}`)
})