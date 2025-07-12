const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const bcrypt = require('bcryptjs');
const session = require('express-session');

const app = express();
const port = 3000;

// Middleware
app.use(cors({
    origin: 'http://localhost:3000',
    credentials: true
}));
app.use(express.json());
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

// Session middleware
app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, // set to true if using https
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Root route - serve login.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Database connection
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'root',
  database: 'hospital_management'
});

db.connect((err) => {
  if (err) {
    console.error('Error connecting to database:', err);
    return;
  }
  console.log('Connected to MySQL database');
});

// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

// Signup route
app.post('/signup', upload.single('profilePic'), async (req, res) => {
  try {
    const { fname, lname, email, password, address, age, occupation } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const profilePic = req.file ? req.file.filename : null;

    if (occupation === 'patient') {
      const [result] = await db.promise().query(
        'INSERT INTO patients (fname, lname, email, password, address, age, profile_pic) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [fname, lname, email, hashedPassword, address, age, profilePic]
      );
      res.json({ message: 'Patient registered successfully', redirect: '/patient-dashboard.html' });
    } else if (occupation === 'doctor') {
      const [result] = await db.promise().query(
        'INSERT INTO doctor_requests (fname, lname, email, password, address, age, profile_pic) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [fname, lname, email, hashedPassword, address, age, profilePic]
      );
      res.json({ message: 'Doctor registration request submitted. Awaiting admin approval.' });
    }
  } catch (error) {
    console.error('Error in signup:', error);
    res.status(500).json({ error: 'An error occurred during signup' });
  }
});

// Login route
app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check admin
    const [admin] = await db.promise().query('SELECT * FROM admin WHERE email = ?', [email]);
    if (admin.length > 0 && admin[0].password === password) {
      req.session.adminId = admin[0].id;
      res.json({ redirect: '/admin.html' });
      return;
    }

    // Check doctor
    const [doctors] = await db.promise().query('SELECT * FROM doctors WHERE email = ?', [email]);
    if (doctors.length > 0) {
      const doctor = doctors[0];
      const match = await bcrypt.compare(password, doctor.password);
      if (match) {
        req.session.doctorId = doctor.id;
        res.json({ redirect: '/doctor-dashboard.html' });
        return;
      }
    }

    // Check patient
    const [patients] = await db.promise().query('SELECT * FROM patients WHERE email = ?', [email]);
    if (patients.length > 0) {
      const patient = patients[0];
      const match = await bcrypt.compare(password, patient.password);
      if (match) {
        req.session.patientId = patient.id;
        res.json({ redirect: '/patient-dashboard.html' });
        return;
      }
    }

    res.status(401).json({ error: 'Invalid credentials' });
  } catch (error) {
    console.error('Error in login:', error);
    res.status(500).json({ error: 'An error occurred during login' });
  }
});

// Logout route
app.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Error destroying session:', err);
      return res.status(500).json({ error: 'Failed to logout' });
    }
    res.clearCookie('connect.sid');
    res.json({ message: 'Logged out successfully' });
  });
});

// Serve HTML pages for main routes
app.get('/signup', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'signup.html'));
});
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});
app.get('/doctor-dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'doctor-dashboard.html'));
});
app.get('/patient-dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'patient-dashboard.html'));
});

// Favicon route (returns 204 No Content if not found)
app.get('/favicon.ico', (req, res) => res.status(204).end());

// Patient data route
app.get('/patient-data', async (req, res) => {
  try {
    const patientId = req.session.patientId;
    if (!patientId) {
      return res.status(401).json({ error: 'Not logged in as patient' });
    }
    const [patient] = await db.promise().query('SELECT * FROM patients WHERE id = ?', [patientId]);
    const [doctors] = await db.promise().query(`
      SELECT d.*, a.disease 
      FROM doctors d 
      JOIN assignments a ON d.id = a.doctor_id 
      WHERE a.patient_id = ?
    `, [patientId]);
    const p = patient[0] || {};
    res.json({
      id: p.id || patientId,
      fname: p.fname || '',
      lname: p.lname || '',
      email: p.email || '',
      address: p.address || '',
      age: p.age || '',
      profile_pic: p.profile_pic || '',
      blood_group: p.blood_group || '',
      disease: p.disease || '',
      appointment_status: p.appointment_status || '',
      appointment_time: p.appointment_time || '',
      doctors: doctors || []
    });
  } catch (error) {
    console.error('Error fetching patient data:', error);
    res.status(500).json({ error: 'An error occurred while fetching patient data' });
  }
});

// Doctor data route
app.get('/doctor-data', async (req, res) => {
  try {
    const doctorId = req.session.doctorId;
    if (!doctorId) {
      return res.status(401).json({ error: 'Not logged in as doctor' });
    }
    const [doctor] = await db.promise().query('SELECT * FROM doctors WHERE id = ?', [doctorId]);
    const [patients] = await db.promise().query(`
      SELECT p.*, a.disease 
      FROM patients p 
      JOIN assignments a ON p.id = a.patient_id 
      WHERE a.doctor_id = ?
    `, [doctorId]);
    const d = doctor[0] || {};
    res.json({
      fname: d.fname || '',
      lname: d.lname || '',
      email: d.email || '',
      address: d.address || '',
      age: d.age || '',
      profile_pic: d.profile_pic || '',
      degree: d.degree || '',
      experience: d.experience || '',
      patients: patients || []
    });
  } catch (error) {
    console.error('Error fetching doctor data:', error);
    res.status(500).json({ error: 'An error occurred while fetching doctor data' });
  }
});

// Update patient route
app.post('/update-patient', upload.single('profilePic'), async (req, res) => {
  try {
    const patientId = req.session.patientId;
    if (!patientId) {
      return res.status(401).json({ error: 'Not logged in as patient' });
    }

    // Log the incoming request data for debugging
    console.log('Update patient request body:', req.body);
    console.log('Update patient file:', req.file);

    const { fname, lname, address, age } = req.body;
    const profilePic = req.file ? req.file.filename : undefined;

    // Validate required fields
    if (!fname || !lname || !address || !age) {
      return res.status(400).json({ 
        error: 'All fields are required',
        received: { fname, lname, address, age }
      });
    }

    // Validate age is a number
    const ageNum = parseInt(age);
    if (isNaN(ageNum) || ageNum < 0 || ageNum > 150) {
      return res.status(400).json({ error: 'Invalid age value' });
    }

    // Build update query
    const updateFields = [];
    const values = [];

    // Add all fields to update
    updateFields.push('fname = ?');
    values.push(fname);
    updateFields.push('lname = ?');
    values.push(lname);
    updateFields.push('address = ?');
    values.push(address);
    updateFields.push('age = ?');
    values.push(ageNum);

    // Add profile picture if provided
    if (profilePic) {
      updateFields.push('profile_pic = ?');
      values.push(profilePic);
    }

    // Add patient ID for WHERE clause
    values.push(patientId);

    // Log the final query and values for debugging
    const query = `UPDATE patients SET ${updateFields.join(', ')} WHERE id = ?`;
    console.log('Update query:', query);
    console.log('Update values:', values);

    // Execute update
    const [result] = await db.promise().query(query, values);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    res.json({ 
      message: 'Patient information updated successfully',
      updated: {
        fname,
        lname,
        address,
        age: ageNum,
        profile_pic: profilePic
      }
    });
  } catch (error) {
    console.error('Error updating patient:', error);
    res.status(500).json({ 
      error: 'An error occurred while updating patient information',
      details: error.message
    });
  }
});

// Update doctor route
app.post('/update-doctor', upload.single('profilePic'), async (req, res) => {
  try {
    const { fname, lname, email, address, age, degree, experience } = req.body;
    const profilePic = req.file ? req.file.filename : undefined;

    const updateFields = [];
    const values = [];

    if (fname) {
      updateFields.push('fname = ?');
      values.push(fname);
    }
    if (lname) {
      updateFields.push('lname = ?');
      values.push(lname);
    }
    if (email) {
      updateFields.push('email = ?');
      values.push(email);
    }
    if (address) {
      updateFields.push('address = ?');
      values.push(address);
    }
    if (age) {
      updateFields.push('age = ?');
      values.push(age);
    }
    if (profilePic) {
      updateFields.push('profile_pic = ?');
      values.push(profilePic);
    }
    if (degree) {
      updateFields.push('degree = ?');
      values.push(degree);
    }
    if (experience) {
      updateFields.push('experience = ?');
      values.push(experience);
    }

    values.push(1); // Replace with actual doctor ID

    await db.promise().query(
      `UPDATE doctors SET ${updateFields.join(', ')} WHERE id = ?`,
      values
    );

    res.json({ message: 'Doctor information updated successfully' });
  } catch (error) {
    console.error('Error updating doctor:', error);
    res.status(500).json({ error: 'An error occurred while updating doctor information' });
  }
});

// Update patient info route (for doctors)
app.post('/update-patient-info', async (req, res) => {
  try {
    const { patientId, bloodGroup, disease, appointmentStatus, appointmentTime } = req.body;

    await db.promise().query(
      'UPDATE patients SET blood_group = ?, disease = ?, appointment_status = ?, appointment_time = ? WHERE id = ?',
      [bloodGroup, disease, appointmentStatus, appointmentTime, patientId]
    );

    res.json({ message: 'Patient information updated successfully' });
  } catch (error) {
    console.error('Error updating patient info:', error);
    res.status(500).json({ error: 'An error occurred while updating patient information' });
  }
});

// Admin routes
app.get('/doctor-requests', async (req, res) => {
  try {
    const [requests] = await db.promise().query('SELECT * FROM doctor_requests WHERE status = "pending"');
    res.json(requests);
  } catch (error) {
    console.error('Error fetching doctor requests:', error);
    res.status(500).json({ error: 'An error occurred while fetching doctor requests' });
  }
});

app.post('/approve-doctor/:id', async (req, res) => {
  try {
    const [request] = await db.promise().query('SELECT * FROM doctor_requests WHERE id = ?', [req.params.id]);
    if (request.length === 0) {
      return res.status(404).json({ error: 'Doctor request not found' });
    }

    const doctor = request[0];
    await db.promise().query(
      'INSERT INTO doctors (fname, lname, email, password, address, age, profile_pic) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [doctor.fname, doctor.lname, doctor.email, doctor.password, doctor.address, doctor.age, doctor.profile_pic]
    );

    await db.promise().query('DELETE FROM doctor_requests WHERE id = ?', [req.params.id]);

    res.json({ message: 'Doctor approved successfully' });
  } catch (error) {
    console.error('Error approving doctor:', error);
    res.status(500).json({ error: 'An error occurred while approving doctor' });
  }
});

app.post('/reject-doctor/:id', async (req, res) => {
  try {
    await db.promise().query('DELETE FROM doctor_requests WHERE id = ?', [req.params.id]);
    res.json({ message: 'Doctor request rejected' });
  } catch (error) {
    console.error('Error rejecting doctor:', error);
    res.status(500).json({ error: 'An error occurred while rejecting doctor' });
  }
});

app.get('/doctors', async (req, res) => {
  try {
    const [doctors] = await db.promise().query('SELECT * FROM doctors');
    res.json(doctors);
  } catch (error) {
    console.error('Error fetching doctors:', error);
    res.status(500).json({ error: 'An error occurred while fetching doctors' });
  }
});

app.get('/patients', async (req, res) => {
  try {
    const [patients] = await db.promise().query('SELECT * FROM patients');
    res.json(patients);
  } catch (error) {
    console.error('Error fetching patients:', error);
    res.status(500).json({ error: 'An error occurred while fetching patients' });
  }
});

app.delete('/delete-doctor/:id', async (req, res) => {
  try {
    await db.promise().query('DELETE FROM doctors WHERE id = ?', [req.params.id]);
    res.json({ message: 'Doctor deleted successfully' });
  } catch (error) {
    console.error('Error deleting doctor:', error);
    res.status(500).json({ error: 'An error occurred while deleting doctor' });
  }
});

app.delete('/delete-patient/:id', async (req, res) => {
  try {
    const patientId = req.params.id;
    // Delete related assignments first
    await db.promise().query('DELETE FROM assignments WHERE patient_id = ?', [patientId]);
    // Now delete the patient
    await db.promise().query('DELETE FROM patients WHERE id = ?', [patientId]);
    res.json({ message: 'Patient deleted successfully' });
  } catch (error) {
    console.error('Error deleting patient:', error);
    res.status(500).json({ error: 'An error occurred while deleting patient' });
  }
});

app.get('/assignments', async (req, res) => {
  try {
    const [assignments] = await db.promise().query(`
      SELECT a.*, 
             CONCAT(p.fname, ' ', p.lname) as patient_name,
             CONCAT(d.fname, ' ', d.lname) as doctor_name
      FROM assignments a
      LEFT JOIN patients p ON a.patient_id = p.id
      LEFT JOIN doctors d ON a.doctor_id = d.id
      ORDER BY a.id DESC
    `);
    res.json(assignments);
  } catch (error) {
    console.error('Error fetching assignments:', error);
    res.status(500).json({ error: 'Failed to fetch assignments' });
  }
});

app.post('/create-assignment', async (req, res) => {
  try {
    const { doctorId, patientId, disease } = req.body;
    await db.promise().query(
      'INSERT INTO assignments (doctor_id, patient_id, disease) VALUES (?, ?, ?)',
      [doctorId, patientId, disease]
    );
    res.json({ message: 'Doctor assigned successfully' });
  } catch (error) {
    console.error('Error creating assignment:', error);
    res.status(500).json({ error: 'An error occurred while creating assignment' });
  }
});

app.delete('/delete-assignment/:id', async (req, res) => {
  try {
    await db.promise().query('DELETE FROM assignments WHERE id = ?', [req.params.id]);
    res.json({ message: 'Assignment deleted successfully' });
  } catch (error) {
    console.error('Error deleting assignment:', error);
    res.status(500).json({ error: 'An error occurred while deleting assignment' });
  }
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Get doctor by id
app.get('/doctor/:id', async (req, res) => {
  try {
    const [rows] = await db.promise().query('SELECT * FROM doctors WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Doctor not found' });
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching doctor info' });
  }
});

// Get patient by id
app.get('/patient/:id', async (req, res) => {
  try {
    const [rows] = await db.promise().query('SELECT * FROM patients WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Patient not found' });
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching patient info' });
  }
});

// Update assignment disease
app.post('/update-assignment/:id', async (req, res) => {
  try {
    const { disease } = req.body;
    await db.promise().query('UPDATE assignments SET disease = ? WHERE id = ?', [disease, req.params.id]);
    res.json({ message: 'Assignment updated successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update assignment' });
  }
});

// Create or update an appointment
app.post('/appointments', async (req, res) => {
  try {
    const { patient_id, doctor_id, disease, status, appointment_time } = req.body;
    await db.promise().query(
      'INSERT INTO appointments (patient_id, doctor_id, disease, status, appointment_time) VALUES (?, ?, ?, ?, ?)',
      [patient_id, doctor_id, disease, status, appointment_time]
    );
    res.json({ message: 'Appointment saved' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to save appointment' });
  }
});

// Update appointment status/time/disease
app.post('/appointments/:id', async (req, res) => {
  try {
    const { disease, status, appointment_time } = req.body;
    await db.promise().query(
      'UPDATE appointments SET disease = ?, status = ?, appointment_time = ? WHERE id = ?',
      [disease, status, appointment_time, req.params.id]
    );
    res.json({ message: 'Appointment updated' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update appointment' });
  }
});

// Get all appointments for a doctor
app.get('/appointments/doctor/:id', async (req, res) => {
  try {
    const [rows] = await db.promise().query(
      `SELECT a.*, CONCAT(p.fname, ' ', p.lname) as patient_name, CONCAT(d.fname, ' ', d.lname) as doctor_name
       FROM appointments a
       LEFT JOIN patients p ON a.patient_id = p.id
       LEFT JOIN doctors d ON a.doctor_id = d.id
       WHERE a.doctor_id = ?
       ORDER BY a.appointment_time DESC`,
      [req.params.id]
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch appointments' });
  }
});

// Get all appointments for a patient
app.get('/appointments/patient/:id', async (req, res) => {
  try {
    const [rows] = await db.promise().query(
      `SELECT a.*, CONCAT(p.fname, ' ', p.lname) as patient_name, CONCAT(d.fname, ' ', d.lname) as doctor_name
       FROM appointments a
       LEFT JOIN patients p ON a.patient_id = p.id
       LEFT JOIN doctors d ON a.doctor_id = d.id
       WHERE a.patient_id = ?
       ORDER BY a.appointment_time DESC`,
      [req.params.id]
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch appointments' });
  }
});

// Get all appointments (admin)
app.get('/appointments', async (req, res) => {
  try {
    const [rows] = await db.promise().query(
      `SELECT a.*, CONCAT(p.fname, ' ', p.lname) as patient_name, CONCAT(d.fname, ' ', d.lname) as doctor_name
       FROM appointments a
       LEFT JOIN patients p ON a.patient_id = p.id
       LEFT JOIN doctors d ON a.doctor_id = d.id
       ORDER BY a.appointment_time DESC`
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch appointments' });
  }
});

// Get single assignment
app.get('/assignments/:id', async (req, res) => {
  try {
    const [assignments] = await db.promise().query(`
      SELECT a.*, 
             CONCAT(p.fname, ' ', p.lname) as patient_name,
             CONCAT(d.fname, ' ', d.lname) as doctor_name
      FROM assignments a
      LEFT JOIN patients p ON a.patient_id = p.id
      LEFT JOIN doctors d ON a.doctor_id = d.id
      WHERE a.id = ?
    `, [req.params.id]);

    if (assignments.length === 0) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    res.json(assignments[0]);
  } catch (error) {
    console.error('Error fetching assignment:', error);
    res.status(500).json({ error: 'Failed to fetch assignment' });
  }
});

// Update assignment
app.put('/assignments/:id', async (req, res) => {
  try {
    const { doctor_id, patient_id, disease, status } = req.body;
    const assignmentId = req.params.id;

    // Validate required fields
    if (!doctor_id || !patient_id || !disease) {
      return res.status(400).json({ error: 'Doctor, patient, and disease are required' });
    }

    // Check if assignment exists
    const [existing] = await db.promise().query('SELECT * FROM assignments WHERE id = ?', [assignmentId]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    // Update assignment
    await db.promise().query(
      'UPDATE assignments SET doctor_id = ?, patient_id = ?, disease = ?, status = ? WHERE id = ?',
      [doctor_id, patient_id, disease, status || 'active', assignmentId]
    );

    // Get updated assignment
    const [updated] = await db.promise().query(`
      SELECT a.*, 
             CONCAT(p.fname, ' ', p.lname) as patient_name,
             CONCAT(d.fname, ' ', d.lname) as doctor_name
      FROM assignments a
      LEFT JOIN patients p ON a.patient_id = p.id
      LEFT JOIN doctors d ON a.doctor_id = d.id
      WHERE a.id = ?
    `, [assignmentId]);

    res.json({
      message: 'Assignment updated successfully',
      assignment: updated[0]
    });
  } catch (error) {
    console.error('Error updating assignment:', error);
    res.status(500).json({ error: 'Failed to update assignment' });
  }
});

// Delete assignment
app.delete('/assignments/:id', async (req, res) => {
  try {
    const assignmentId = req.params.id;

    // Check if assignment exists
    const [existing] = await db.promise().query('SELECT * FROM assignments WHERE id = ?', [assignmentId]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Assignment not found' });
    }
    // Delete assignment
    await db.promise().query('DELETE FROM assignments WHERE id = ?', [assignmentId]);

    res.json({ message: 'Assignment deleted successfully' });
  } catch (error) {
    console.error('Error deleting assignment:', error);
    res.status(500).json({ error: 'Failed to delete assignment' });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
