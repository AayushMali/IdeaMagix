import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from "dotenv";
import multer from 'multer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

//multer for PDF
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, 'public', 'prescriptions');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'custom_' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed!'), false);
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024
  }
});

const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN || "", credentials: true }));

const doctors = (() => {
  if (!process.env.DOCTORS_JSON) return [];

  try {
    const parsed = JSON.parse(process.env.DOCTORS_JSON);
    if (!Array.isArray(parsed)) return [];

    return parsed.map((doctor) => ({
      ...doctor,
      createdAt: doctor.createdAt ? new Date(doctor.createdAt) : new Date(),
    }));
  } catch (error) {
    console.warn("Invalid DOCTORS_JSON. Using empty doctors list.", error);
    return [];
  }
})();

const patients = (() => {
  if (!process.env.PATIENTS_JSON) return [];

  try {
    const parsed = JSON.parse(process.env.PATIENTS_JSON);
    if (!Array.isArray(parsed)) return [];

    return parsed.map((patient) => ({
      ...patient,
      createdAt: patient.createdAt ? new Date(patient.createdAt) : new Date(),
    }));
  } catch (error) {
    console.warn("Invalid PATIENTS_JSON. Using empty patients list.", error);
    return [];
  }
})();

const consultations = [
  {
    id: 1,
    patientId: 1,
    doctorId: 1,
    patientName: "Shreya Jain",
    patientEmail: "shreya@demo.com",
    patientAge: 28,
    patientPhone: "+919988776655",
    doctorName: "Dr. Aayush Mali",
    doctorSpecialty: "Cardiologist",
    currentIllness: "I have chest pain and difficulty breathing for the past 2 days",
    recentSurgery: "None",
    surgeryTimespan: "",
    diabetesHistory: "non-diabetic",
    allergies: "Penicillin allergy",
    others: "Family history of high blood pressure",
    transactionId: "TXN1234567890",
    submittedAt: new Date("2024-01-20"),
  },
];

const PORT = process.env.PORT || 3000;
let currentDoctor = null;
let currentPatient = null;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));
app.set("view engine", "ejs");
app.set("views", "./views");
app.use(express.json());

app.get("/", (req, res) => {
  res.redirect("/patientSignCheck");
});

app.get("/doctorSignCheck", (req, res) => {
  if (!currentDoctor) {
    return res.render("doctorSignup.ejs");
  } else {
    res.redirect("/doctorDashboard");
  }
});

app.get("/doctorSignIn", (req, res) => {
  res.render("doctorSignin.ejs");
});

app.post("/doctorSignUp", (req, res) => {
  const { name, email, password, phone, specialty, yearsOfExperience, profilePicture } = req.body;

  if (doctors.find(d => d.email === email)) {
    return res.status(400).json({ error: "Email already exists" });
  }
  if (doctors.find(d => d.phone === phone)) {
    return res.status(400).json({ error: "Phone already exists" });
  }

  const newDoc = {
    id: doctors.length + 1,
    name, email, password, phone,
    specialty,
    yearsOfExperience: parseFloat(yearsOfExperience),
    profilePicture: profilePicture || null,
    createdAt: new Date(),
  };

  doctors.push(newDoc);
  currentDoctor = newDoc;
  res.redirect("/doctorDashboard");
});

app.post("/doctorSignIn", (req, res) => {
  const { email, password } = req.body;
  const doc = doctors.find(d => d.email === email && d.password === password);

  if (doc) {
    currentDoctor = doc;
    res.redirect("/doctorDashboard");
  } else {
    res.status(401).json({ error: "Wrong email or password" });
  }
});

app.get("/patientSignCheck", (req, res) => {
  if (!currentPatient) {
    return res.render("patientSignup.ejs");
  } else {
    res.redirect("/patientDashboard");
  }
});

app.get("/patientSignIn", (req, res) => {
  res.render("patientSignin.ejs");
});

app.post("/patientSignUp", (req, res) => {
  const { name, email, password, age, phone, surgeryHistory, illnessHistory, profilePicture } = req.body;

  if (patients.find(p => p.email === email)) {
    return res.status(400).json({ error: "Email already exists" });
  }
  if (patients.find(p => p.phone === phone)) {
    return res.status(400).json({ error: "Phone already exists" });
  }

  const surgeries = surgeryHistory
    ? surgeryHistory.split(",").map(s => s.trim()).filter(s => s)
    : [];
  const illnesses = illnessHistory
    ? illnessHistory.split(",").map(i => i.trim()).filter(i => i)
    : [];

  const newPatient = {
    id: patients.length + 1,
    name, email, password,
    age: parseInt(age),
    phone,
    profilePicture: profilePicture || null,
    surgeryHistory: surgeries,
    illnessHistory: illnesses,
    createdAt: new Date(),
  };

  patients.push(newPatient);
  currentPatient = newPatient;
  res.redirect("/patientDashboard");
});

app.post("/patientSignIn", (req, res) => {
  const { email, password } = req.body;
  const patient = patients.find(p => p.email === email && p.password === password);

  if (patient) {
    currentPatient = patient;
    res.redirect("/patientDashboard");
  } else {
    res.status(401).json({ error: "Wrong email or password" });
  }
});

app.get("/doctor", (req, res) => {
  res.render("doctor.ejs", { doctor: currentDoctor });
});

app.get("/patient", (req, res) => {
  res.render("patient.ejs", { patient: currentPatient });
});

app.get("/doctorDashboard", (req, res) => {
  if (!currentDoctor) {
    return res.redirect("/doctorSignCheck");
  }
  res.render("doctorDashboard.ejs", { doctor: currentDoctor });
});

app.get("/doctorProfile", (req, res) => {
  if (!currentDoctor) {
    return res.redirect("/doctorSignCheck");
  }
  res.render("doctorProfile.ejs", { doctor: currentDoctor });
});

app.get("/patientDashboard", (req, res) => {
  if (!currentPatient) {
    return res.redirect("/patientSignCheck");
  }
  res.render("patientDashboard.ejs", { patient: currentPatient });
});

app.get("/findDoctors", (req, res) => {
  if (!currentPatient) {
    return res.redirect("/patientSignCheck");
  }
  res.render("doctorsList.ejs", { doctors: doctors });
});

app.get("/consultation/:doctorId", (req, res) => {
  if (!currentPatient) {
    return res.redirect("/patientSignCheck");
  }
  const doctor = doctors.find((d) => d.id == req.params.doctorId);
  if (!doctor) {
    return res.status(404).send("Doctor not found");
  }
  res.render("consultationForm.ejs", { doctor: doctor });
});

app.post("/submitConsultation/:doctorId", (req, res) => {
  if (!currentPatient) return res.status(401).json({ error: "Not logged in" });

  const doc = doctors.find(d => d.id == req.params.doctorId);
  if (!doc) return res.status(404).json({ error: "Doctor not found" });

  const consultation = {
    id: consultations.length + 1,
    patientId: currentPatient.id,
    doctorId: doc.id,
    patientName: currentPatient.name,
    patientEmail: currentPatient.email,
    patientAge: currentPatient.age,
    patientPhone: currentPatient.phone,
    doctorName: doc.name,
    doctorSpecialty: doc.specialty,
    ...req.body,
    submittedAt: new Date(),
  };
  
  consultations.push(consultation);
  console.log("Consultation saved from", currentPatient.name, "to", doc.name);
  res.json({ success: true });
});

app.get("/prescriptionPage", (req, res) => {
  if (!currentDoctor) return res.redirect("/doctorSignCheck");
  const appts = consultations.filter(c => c.doctorId === currentDoctor.id);
  res.render("prescriptionPage.ejs", { doctor: currentDoctor, consultations: appts });
});

app.post("/submitPrescription/:consultationId", (req, res) => {
  if (!currentDoctor) return res.status(401).json({ error: "Not logged in" });

  const consultation = consultations.find(c => c.id == req.params.consultationId);
  if (!consultation) return res.status(404).json({ error: "Consultation not found" });
  
  if (consultation.doctorId !== currentDoctor.id) {
    return res.status(403).json({ error: "Not authorized" });
  }

  const { careToBeTaken, medicines } = req.body;
  
  if (!careToBeTaken || careToBeTaken.trim() === '') {
    return res.status(400).json({ error: "Care to be taken is required" });
  }

  const pdfFileName = `prescription_${consultation.id}_${Date.now()}.pdf`;
  
  consultation.prescription = {
    careToBeTaken,
    medicines: medicines || '',
    prescribedAt: new Date(),
    prescribedBy: currentDoctor.name,
    pdfFile: pdfFileName
  };
  
  res.json({ success: true, pdfFile: pdfFileName });
});

app.get("/generatePrescriptionPDF/:consultationId", (req, res) => {
  if (!currentDoctor) return res.status(401).send("Not logged in");

  const consultation = consultations.find(c => c.id == req.params.consultationId);
  if (!consultation || !consultation.prescription) {
    return res.status(404).send("Prescription not found");
  }

  const doc = new PDFDocument({ margin: 50 });
  const pdfFileName = consultation.prescription.pdfFile || `prescription_${consultation.id}.pdf`;
  const pdfPath = path.join(__dirname, 'public', 'prescriptions', pdfFileName);

  const writeStream = fs.createWriteStream(pdfPath);
  doc.pipe(writeStream);
  doc.pipe(res);

  // header
  doc.fontSize(20).fillColor('#333').text('MEDICAL PRESCRIPTION', { align: 'center' });
  doc.moveDown(0.5);
  doc.fontSize(10).fillColor('#666').text('This is an official medical prescription', { align: 'center' });
  doc.moveDown(2);

  doc.fontSize(14).fillColor('#000').text('Doctor Information', { underline: true });
  doc.moveDown(0.5);
  doc.fontSize(11).text(`Name: ${consultation.doctorName}`);
  doc.text(`Specialty: ${consultation.doctorSpecialty}`);
  doc.text(`Date: ${new Date(consultation.prescription.prescribedAt).toLocaleDateString('en-IN', { 
    year: 'numeric', month: 'long', day: 'numeric' 
  })}`);
  doc.moveDown(1.5);

  // Patient Info
  doc.fontSize(14).fillColor('#000').text('Patient Information', { underline: true });
  doc.moveDown(0.5);
  doc.fontSize(11).text(`Name: ${consultation.patientName}`);
  doc.text(`Age: ${consultation.patientAge} years`);
  doc.text(`Phone: ${consultation.patientPhone}`);
  doc.text(`Email: ${consultation.patientEmail}`);
  doc.moveDown(1.5);

  // medical history
  doc.fontSize(14).fillColor('#000').text('Medical History', { underline: true });
  doc.moveDown(0.5);
  doc.fontSize(11).text(`Current Illness: ${consultation.currentIllness}`);
  if (consultation.recentSurgery && consultation.recentSurgery !== 'None') {
    doc.text(`Recent Surgery: ${consultation.recentSurgery}`);
    if (consultation.surgeryTimespan) {
      doc.text(`Time Since Surgery: ${consultation.surgeryTimespan}`);
    }
  }
  doc.text(`Diabetes History: ${consultation.diabetesHistory || 'Not specified'}`);
  if (consultation.allergies) {
    doc.text(`Allergies: ${consultation.allergies}`);
  }
  doc.moveDown(1.5);

  // prescription
  doc.fontSize(14).fillColor('#000').text('PRESCRIPTION', { underline: true });
  doc.moveDown(0.5);
  
  doc.fontSize(12).fillColor('#c00').text('Care to be Taken:', { continued: false });
  doc.moveDown(0.3);
  doc.fontSize(11).fillColor('#000').text(consultation.prescription.careToBeTaken, {
    align: 'justify'
  });
  doc.moveDown(1);

  if (consultation.prescription.medicines) {
    doc.fontSize(12).fillColor('#c00').text('Medicines:', { continued: false });
    doc.moveDown(0.3);
    doc.fontSize(11).fillColor('#000').text(consultation.prescription.medicines, {
      align: 'justify'
    });
  }
  doc.moveDown(2);

  // Txn Info
  if (consultation.transactionId) {
    doc.fontSize(9).fillColor('#888').text(`Transaction ID: ${consultation.transactionId}`, { align: 'right' });
  }

  doc.moveDown(1);
  doc.fontSize(10).fillColor('#666').text('_'.repeat(60), { align: 'center' });
  doc.fontSize(9).text(`Dr. ${consultation.doctorName}`, { align: 'center' });
  doc.fontSize(8).fillColor('#888').text('Digital Signature', { align: 'center' });

  doc.end();

  writeStream.on('finish', () => {
    console.log(`PDF saved: ${pdfPath}`);
  });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${pdfFileName}"`);
});

app.post("/sendPrescriptionToPatient/:consultationId", (req, res) => {
  if (!currentDoctor) return res.status(401).json({ error: "Not logged in" });

  const consultation = consultations.find(c => c.id == req.params.consultationId);
  if (!consultation || !consultation.prescription) {
    return res.status(404).json({ error: "Prescription not found" });
  }

  if (consultation.doctorId !== currentDoctor.id) {
    return res.status(403).json({ error: "Not authorized" });
  }

  consultation.prescription.sentToPatient = true;
  consultation.prescription.sentAt = new Date();

  res.json({ 
    success: true, 
    message: `Prescription sent to ${consultation.patientName} at ${consultation.patientEmail}` 
  });
});

app.post("/uploadPrescriptionPDF/:consultationId", upload.single('pdfFile'), (req, res) => {
  if (!currentDoctor) return res.status(401).json({ error: "Not logged in" });

  const consultation = consultations.find(c => c.id == req.params.consultationId);
  if (!consultation) {
    return res.status(404).json({ error: "Consultation not found" });
  }

  if (consultation.doctorId !== currentDoctor.id) {
    return res.status(403).json({ error: "Not authorized" });
  }

  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  if (!consultation.prescription) {
    consultation.prescription = {
      careToBeTaken: req.body.notes || 'Please refer to the attached prescription.',
      medicines: '',
      prescribedAt: new Date(),
      prescribedBy: currentDoctor.name,
    };
  }

  if (!consultation.prescription.customPDFs) {
    consultation.prescription.customPDFs = [];
  }

  consultation.prescription.customPDFs.push({
    filename: req.file.filename,
    originalName: req.file.originalname,
    uploadedAt: new Date(),
    notes: req.body.notes || ''
  });

  res.json({ 
    success: true, 
    message: 'PDF uploaded successfully',
    filename: req.file.filename
  });
});

// Download custom PDF
app.get("/downloadPDF/:filename", (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(__dirname, 'public', 'prescriptions', filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).send("File not found");
  }

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.sendFile(filePath);
});

app.get("/doctorAppointments", (req, res) => {
  if (!currentDoctor) return res.redirect("/doctorSignCheck");
  const appts = consultations.filter(c => c.doctorId === currentDoctor.id);
  res.render("doctorAppointments.ejs", { doctor: currentDoctor, consultations: appts });
});

app.get("/patientAppointments", (req, res) => {
  if (!currentPatient) return res.redirect("/patientSignCheck");
  const appts = consultations.filter(c => c.patientId === currentPatient.id);
  res.render("patientAppointments.ejs", { patient: currentPatient, consultations: appts });
});

app.get("/doctorLogout", (req, res) => {
  currentDoctor = null;
  res.redirect("/");
});

app.get("/patientLogout", (req, res) => {
  currentPatient = null;
  res.redirect("/");
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
