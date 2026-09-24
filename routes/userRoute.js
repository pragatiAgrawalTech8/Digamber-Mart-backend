import express from "express"

import { register, verify, reVerify, login, logout, forgotPassword, verifyOTP, changePassword, allUser, updateUser,getSingleUser,makeAdmin } from "../controllers/userController.js"
import {isAdmin,isAuthenticated} from "../middleware/isAuthenticated.js"
import {singleUpload} from "../middleware/multer.js"

const router = express.Router()

router.post("/register", register)
router.post("/verify", verify)
router.post("/reVerify", reVerify)
router.post("/login", login)
router.post("/logout", isAuthenticated, logout)
router.post("/forgot-password", forgotPassword)
router.post("/verify-otp/:email", verifyOTP)
router.post("/change-password/:email", changePassword)
router.get("/all-user",isAuthenticated,isAdmin, allUser)
router.put("/update/:id",isAuthenticated,singleUpload,updateUser)
router.get("/get-user/:id", isAuthenticated, getSingleUser)
router.put("/make-admin/:id",isAuthenticated,isAdmin,makeAdmin)
export default router