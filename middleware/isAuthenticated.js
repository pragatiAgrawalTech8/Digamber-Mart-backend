
import { User } from "../models/userModel.js"
import jwt from "jsonwebtoken";
export const isAuthenticated = async (req, res, next) => {
    try {
         console.log("Authorization Header:", req.headers.authorization);
        const authHeader = req.headers.authorization
        console.log("Authorization Header:", authHeader);
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(400).json({
                success: false,
                message: "Authorization token is missing or invalid"
            })
        }

        const token = authHeader.split(" ")[1]
        console.log("Received Token:", token)
        let decoded
        try {
            decoded = jwt.verify(token, process.env.SECRET_KEY)
            console.log("Decoded Token:", decoded);
        } catch (error) {
            if (error.name === "TokenExpiredError") {
                return res.status(400).json({
                    success: false,
                    message: "The registration token has expired"
                })
            }
            return res.status(400).json({
                success: false,
                message: "Access token is missing or invalid"
            })
        }

        const user = await User.findById(decoded.id)
        console.log("User Found:", user)
        if (!user) {
            return res.status(400).json({
                success: false,
                message: "User not find"
            })
        }
        req.user = user
        req.id = user._id
        next()

    } catch (error) {
        console.log("Auth Error:", error)
        return res.status(500).json({
            success: false,
            message: error.message
        })
    }
}

export const isAdmin = (req, res, next) => {
    console.log("Role:", req.user.role);
    if (req.user && req.user.role === 'admin') {
        next()
    } else {
        console.log("Not Admin")
        return res.status(403).json({
            message: "Access denied : admins only"
        })
    }
}