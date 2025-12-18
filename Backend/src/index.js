import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { db } from './config/db.js';
import cookieParser from "cookie-parser";
import { runWarmup } from "./lib/warmup.js";
import { fileURLToPath } from "url";
import path from "path";
import { requireAuth } from "./middleware/authMiddleware.js";
import { requireRole } from "./middleware/requireRole.js";

//routes
import userRoutes from "./routes/userRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import tenantsRoutes from "./routes/tenantRoutes.js";
import timereportRoutes from "./routes/timereportRoutes.js";
import timereportsRouter from "./routes/time-reportsRoutes.js";
import adminRoute from "./routes/adminRoutes.js";

dotenv.config();
const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const corsOptions = {
    origin: [process.env.FRONTEND_ORIGIN, 'http://localhost:5173',"http://localhost:4173"].filter(Boolean),
    methods: ['GET','POST','PATCH','PUT','DELETE','OPTIONS'],
    allowedHeaders: ['Content-Type','Authorization'],
    credentials: true,  
    maxAge: 86400, 
  };


app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));
app.use(express.json());
app.use(cookieParser());




//Routes
app.use("/", express.static(path.join(__dirname, "docs")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/api/users", userRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/tenants", tenantsRoutes);
app.use('/api/timereport', requireAuth , timereportRoutes);
app.use('/api/time-reports', requireAuth , timereportsRouter);
app.use("/api/admin", requireAuth, requireRole("admin"), adminRoute);


app.get('/db-check', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT 1');
        res.json({ success: true, message: 'DB connection OK', rows });
        console.log('DB connection successful:', rows);
    } catch (err) {
        res
            .status(500)
            .json({ success: false, message: 'DB connection failed' + err.message });
        console.log('DB connection failed:', err.message);
    }
});

const port = process.env.PORT || 5000;

app.listen(port, ()=>console.log("server is running on http://localhost:5000"));

await runWarmup();
setInterval(async () => {
  try {
    const conn = await db.getConnection();
    await conn.ping();
    conn.release();
    console.log("[DB ping] OK");
  } catch (err) {
    console.error("[DB ping] failed:", err.message);
  }
}, 60000);