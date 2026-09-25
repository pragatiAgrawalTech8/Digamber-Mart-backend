console.log("Pragati");
import express from "express";
import connectDB from "./database/db.js";
import "dotenv/config";
import cors from "cors";
import userRoute from "./routes/userRoute.js";
import productRoute from "./routes/productRoute.js";
import cartRoute from "./routes/cartRoute.js";
import orderRoute from "./routes/orderRoute.js";

const app = express();
const PORT = process.env.PORT || 5555;

// ✅ Fixed CORS — multiple origins
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  "https://www.digambermart.com",
  "https://digambermart.com",
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests without origin (Postman, curl, mobile apps)
    if (!origin) return callback(null, true);

    // Allow if in list OR any vercel.app subdomain
    if (
      allowedOrigins.includes(origin) ||
      /\.vercel\.app$/.test(origin)
    ) {
      return callback(null, true);
    }

    console.log("❌ CORS blocked:", origin);
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

app.use(express.json());

app.use("/api/v1/user", userRoute);
app.use("/api/v1/product", productRoute);
app.use("/api/v1/cart", cartRoute);
app.use("/api/v1/orders", orderRoute);

try {
  await connectDB();
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is listening at port ${PORT}`);
  });
} catch (error) {
  console.log("Failed to start server", error);
}