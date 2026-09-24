console.log("Pragati");
import express from "express"
import connectDB from "./database/db.js"
import "dotenv/config"
import cors from "cors"
import userRoute from "./routes/userRoute.js"
import productRoute from "./routes/productRoute.js"
import cartRoute from "./routes/cartRoute.js"
import orderRoute from "./routes/orderRoute.js"

const app = express()
const PORT = process.env.PORT || 5555

//middleware
app.use(express.json())
app.use(cors({
  origin: "http://localhost:5173/",
  credentials: true,
}))

app.use("/api/v1/user", userRoute)
app.use("/api/v1/product", productRoute)
app.use("/api/v1/cart", cartRoute)
app.use("/api/v1/orders", orderRoute)
try {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`Server is listening at port ${PORT}`);
  });
} catch (error) {
  console.log("Failed to start server", error);
}