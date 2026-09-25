
import { User } from "../models/userModel.js"
import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken"
import { verifyEmail } from "../emailVerify/verifyemail.js";
import { Session } from "../models/sessionModel.js"
import { sendOTPMail } from "../emailVerify/sendOTPMail.js";
import cloudinary from "../config/cloudinary.js";

export const register = async (req, res) => {
    try {
        const { firstName, lastName, email, password } = req.body;

        if (!firstName || !lastName || !email || !password) {
            return res.status(400).json({
                success: false,
                message: "All fields are required"
            });
        }

        const existingUser = await User.findOne({ email });

        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: "User already exists"
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = await User.create({
            firstName,
            lastName,
            email,
            password: hashedPassword,
            isVerified: false
        });


        // Email verification token
        const verifyToken = jwt.sign(
            { id: newUser._id },
            process.env.SECRET_KEY,
            { expiresIn: "10m" }
        );

        await verifyEmail(verifyToken, email);


        // Access token for frontend storage
        const accessToken = jwt.sign(
            { id: newUser._id },
            process.env.SECRET_KEY,
            { expiresIn: "7d" }
        );


        return res.status(201).json({
            success: true,
            message: "User registered successfully",
            accessToken,
            user: {
                id: newUser._id,
                firstName: newUser.firstName,
                lastName: newUser.lastName,
                email: newUser.email
            }
        });


    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

export const verify = async (req, res) => {
    try {
        const authHeader = req.headers.authorization
        if (!authHeader || !authHeader.startsWith("Bearer "))
            return res.status(400).json({ success: false, message: "Authorization token is missing or invalid" })
        const token = authHeader.split(" ")[1] // Bearer hsdjkdksdhd
        let decoded
        try {
            decoded = jwt.verify(token, process.env.SECRET_KEY)

        } catch (error) {
            if (error.name === "TokenExpiredError") {
                return res.status(400).json({
                    success: false,
                    message: "the registretion token has expired"
                })
            }
            return res.status(400).json({
                success: false,
                message: "Token verification failed"
            })
        }
        const user = await User.findById(decoded.id)
        if (!user) {
            return res.status(400).json({
                success: false,
                message: "User not found"
            })
        }
        user.token = null
        user.isVerified = true
        await user.save()
        return res.status(200).json({
            success: true,
            message: "Email verified successfully"
        })
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        })
    }



}

export const reVerify = async (req, res) => {
    try {
        const { email } = req.body
        const user = await User.findOne({ email })
        if (!user) {
            return res.status(400).json({ success: false, message: "user not found" })

        }
        const token = jwt.sign({ id: user._id }, process.env.SECRET_KEY, { expiresIn: "10m" })
        verifyEmail(token, email)
        user.token = token
        await user.save()
        return res.status(200).json({
            success: true,
            message: "Verification email sent again successfully",
            token: user.token
        })
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        })
    }
}

export const login = async (req, res) => {
    try {
        const { email, password } = req.body
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "All fields are required"
            })
        }
        const existingUser = await User.findOne({ email })
        if (!existingUser) {
            return res.status(400).json({
                success: false,
                message: "User not exists"
            })
        }
        const isPasswordValid = await bcrypt.compare(password, existingUser.password)
        if (!isPasswordValid) {
            return res.status(400).json({
                success: false,
                message: "Invalid Credentials"
            })
        }
        if (existingUser.isVerified === false) {
            return res.status(400).json({
                success: false,
                message: "Verify your account then login"
            })
        }
        //generate token
        const accessToken = jwt.sign({ id: existingUser._id }, process.env.SECRET_KEY, { expiresIn: "10d" })
        const refreshToken = jwt.sign({ id: existingUser._id }, process.env.SECRET_KEY, { expiresIn: "30d" })
        console.log("Logged User ID:", existingUser._id);
        console.log("Logged User Email:", existingUser.email);
        console.log("Generated Token:", accessToken);
        existingUser.isLoggedIn = true
        await existingUser.save()

        //check for existing session and delete it
        const existingSession = await Session.findOne({ userId: existingUser._id })
        if (existingSession) {
            await Session.deleteOne({ userId: existingUser._id })
        }
        // Create a new session
        await Session.create({ userId: existingUser._id })
        return res.status(200).json({
            success: true,
            message: `Welcome back ${existingUser.firstName}`,
            user: existingUser,
            accessToken,
            refreshToken
        })


    } catch (error) {
        console.log("Login Error:", error)
        res.status(500).json({
            success: false,
            message: error.message
        })
    }
}

export const logout = async (req, res) => {
    console.log("Logout controller called");
    try {
        console.log(req.id)
        const userId = req.id
        await Session.deleteMany({ userId: userId })
        await User.findByIdAndUpdate(userId, { isLoggedIn: false })
        return res.status(200).json({
            success: true,
            message: "User logged out successfully"
        })
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        })
    }
}

export const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body
        const user = await User.findOne({ email })
        if (!user) {
            return res.status(400).json({
                success: false,
                message: "User not found"
            })
        }
        const otp = Math.floor(100000 + Math.random() * 900000);
        // const otp = Math.floor(100000 + Math.random*900000).toString()
        // const otpExpiry = new Date(Date.now()*10*60*1000) // 10 min
        const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
        user.otp = otp
        user.otpExpiry = otpExpiry

        await user.save()
        await sendOTPMail(otp, email)

        return res.status(200).json({
            success: true,
            message: "Otp sent to email successfully"
        })
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        })
    }
}

export const verifyOTP = async (req, res) => {
    try {
        const { otp } = req.body
        const email = req.params.email
        if (!otp) {
            return res.status(400).json({
                success: false,
                message: "Otp is required"
            })
        }
        const user = await User.findOne({ email })
        if (!user) {
            return res.status(400).json({
                success: false,
                message: "User not found"
            })
        }
        if (!user.otp || !user.otpExpiry) {
            return res.status(400).json({
                success: false,
                message: "Otp is not generated or already verified"
            })
        }
        if (user.otpExpiry < new Date()) {
            return res.status(400).json({
                success: false,
                message: "Otp has expired please request a new one"
            })
        }
        if (Number(otp) !== Number(user.otp)) {
            return res.status(400).json({
                success: false,
                message: "Otp is Invalid"
            })
        }
        user.otp = null
        user.otpExpiry = null
        await user.save()
        return res.status(200).json({
            success: true,
            message: "Otp verified successfully"
        })

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        })
    }
}

export const changePassword = async (req, res) => {
    try {
        const { newPassword, confirmPassword } = req.body
        const { email } = req.params
        const user = await User.findOne({ email })
        if (!user) {
            return res.status(400).json({
                success: false,
                message: "User not found"
            })
        }
        if (!newPassword || !confirmPassword) {
            return res.status(400).json({
                success: false,
                message: "All fields are required"
            })
        }
        if (newPassword !== confirmPassword) {
            return res.status(400).json({
                success: false,
                message: "Password do not match"
            })
        }
        const hashedPassword = await bcrypt.hash(newPassword, 10)
        user.password = hashedPassword
        await user.save()
        return res.status(200).json({
            success: true,
            message: "Password changed successfully"
        })
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        })
    }
}

export const allUser = async (_, res) => {
    console.log("allUser controller called")
    try {
        const users = await User.find()
        return res.status(200).json({
            success: true,
            users
        })
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        })
    }
}

export const getUserById = async (req, res) => {
    try {
        const { userId } = req.params //extract userId from request params
        const user = await User.findById(userId).select("-password -otp -otpExpiry -token")
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            })
        }
        res.status(200).json({
            success: true,
            user
        })
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        })
    }
}

export const updateUser = async (req, res) => {
    try {
        const userIdToUpdate = req.params.id; // the ID of the user we want to update
        const loggedInUser = req.user; // from isAuthenticated middleware
        const { firstName, lastName, address, city, zipCode, phoneNo, role } = req.body;

        // Check if user is authorized to update this profile
        if (loggedInUser._id.toString() !== userIdToUpdate && loggedInUser.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: "You are not allowed to update this profile"
            });
        }

        // Find the user to update
        let user = await User.findById(userIdToUpdate);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        // Handle profile picture upload
        let profilePicUrl = user.profilePic;
        let profilePicPublicId = user.profilePicPublicId;

        // If a new file is uploaded
        if (req.file) {
            // Delete old image from Cloudinary if it exists
            if (profilePicPublicId) {
                await cloudinary.uploader.destroy(profilePicPublicId);
            }

            // Upload new image to Cloudinary
            const uploadResult = await new Promise((resolve, reject) => {
                const stream = cloudinary.uploader.upload_stream(
                    { folder: "profiles" },
                    (error, result) => {
                        if (error) reject(error);
                        else resolve(result);
                    }
                );
                stream.end(req.file.buffer);
            });

            profilePicUrl = uploadResult.secure_url;
            profilePicPublicId = uploadResult.public_id;
        }

        // Update fields
        user.firstName = firstName || user.firstName;
        user.lastName = lastName || user.lastName;
        user.address = address || user.address;
        user.city = city || user.city;
        user.zipCode = zipCode || user.zipCode;
        user.phoneNo = phoneNo || user.phoneNo;
        user.role = role || user.role; // Keep existing role if not provided
        user.profilePic = profilePicUrl;
        user.profilePicPublicId = profilePicPublicId;

        const updatedUser = await user.save();

        return res.status(200).json({
            success: true,
            message: "Profile Updated Successfully",
            data: updatedUser
        });

    } catch (error) {
        console.error("Update user error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal Server Error",
            error: error.message // Include error message for debugging
        });
    }
};

export const getSingleUser = async (req, res) => {
    try {
        const { id } = req.params;

        const user = await User.findById(id).select("-password");

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        return res.status(200).json({
            success: true,
            user,
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};
export const makeAdmin = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    user.role = "admin";
    await user.save();

    return res.status(200).json({
      success: true,
      message: "User promoted to Admin",
      user,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};


