
import { User } from "../models/userModel.js"
import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken"
import { verifyEmail } from "../emailVerify/verifyemail.js";
import { Session } from "../models/sessionModel.js"
import { sendOTPMail } from "../emailVerify/sendOTPMail.js";
import cloudinary from "../config/cloudinary.js";
import { sendOtp } from "../services/otpService.js"
import { verifyOtp as msg91Verify } from "../services/otpService.js";
import { retryOtp as msg91Retry } from "../services/otpService.js"; 
// export const register = async (req, res) => {
//     try {
//         const { firstName, lastName, email, password } = req.body;

//         if (!firstName || !lastName || !email || !password) {
//             return res.status(400).json({
//                 success: false,
//                 message: "All fields are required"
//             });
//         }

//         const existingUser = await User.findOne({ email });

//         if (existingUser) {
//             return res.status(400).json({
//                 success: false,
//                 message: "User already exists"
//             });
//         }

//         const hashedPassword = await bcrypt.hash(password, 10);

//         const newUser = await User.create({
//             firstName,
//             lastName,
//             email,
//             password: hashedPassword,
//             isVerified: false
//         });


//         // Email verification token
//         const verifyToken = jwt.sign(
//             { id: newUser._id },
//             process.env.SECRET_KEY,
//             { expiresIn: "10m" }
//         );

//         await verifyEmail(verifyToken, email);


//         // Access token for frontend storage
//         const accessToken = jwt.sign(
//             { id: newUser._id },
//             process.env.SECRET_KEY,
//             { expiresIn: "7d" }
//         );


//         return res.status(201).json({
//             success: true,
//             message: "User registered successfully",
//             accessToken,
//             user: {
//                 id: newUser._id,
//                 firstName: newUser.firstName,
//                 lastName: newUser.lastName,
//                 email: newUser.email
//             }
//         });


//     } catch (error) {
//         return res.status(500).json({
//             success: false,
//             message: error.message
//         });
//     }
// };
export const register = async (req, res) => {
  try {
    console.log("Body received:", req.body);

    const { firstName, lastName, email, password, phoneNo } = req.body;

    // ✅ Validation
    if (!firstName || !lastName || !email || !password || !phoneNo) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    // ✅ Email format check
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Invalid email address",
      });
    }

    // ✅ Phone number check (10 digit Indian)
    if (!/^[6-9]\d{9}$/.test(phoneNo)) {
      return res.status(400).json({
        success: false,
        message: "Invalid phone number",
      });
    }

    // ✅ Check existing user by email
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "User already exists with this email",
      });
    }

    // ✅ Check existing user by phoneNo
    const existingPhone = await User.findOne({ phoneNo });
    if (existingPhone) {
      return res.status(400).json({
        success: false,
        message: "User already exists with this phone number",
      });
    }

    // ✅ Password hash करें
    const hashedPassword = await bcrypt.hash(password, 10);

    // ✅ User create करें (Model के field names के साथ exactly match)
    const user = await User.create({
      firstName,
      lastName,
      email,
      password: hashedPassword,
      phoneNo,
      isVerified: false,
    });

    // ✅ MSG91 से OTP भेजें
    try {
      const otpResponse = await sendOtp(phoneNo);
      console.log("MSG91 OTP Response:", otpResponse);
    } catch (otpError) {
      console.log("OTP send failed:", otpError.message);
      // अगर OTP fail हो, तो user delete कर दें
      await User.findByIdAndDelete(user._id);
      return res.status(500).json({
        success: false,
        message: "Failed to send OTP. Please try again.",
      });
    }

    res.status(201).json({
      success: true,
      message: "OTP sent to your mobile",
      user: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phoneNo: user.phoneNo,
      },
    });

  } catch (error) {
    console.log("Register error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
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



export const verifyOtp = async (req, res) => {
  try {
    console.log("Verify body:", req.body);

    const { phoneNo, otp } = req.body;

    if (!phoneNo || !otp) {
      return res.status(400).json({
        success: false,
        message: "Phone number and OTP are required",
      });
    }

    // ✅ MSG91 से OTP verify करें
    const result = await msg91Verify(phoneNo, otp);
    console.log("MSG91 verify response:", result);

    if (result.type === "success") {
      // ✅ User को verified mark करें
      const user = await User.findOneAndUpdate(
        { phoneNo },
        { isVerified: true },
        { new: true }
      );

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      return res.status(200).json({
        success: true,
        message: "Phone verified successfully",
        user: {
          _id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phoneNo: user.phoneNo,
          isVerified: user.isVerified,
        },
      });
    } else {
      return res.status(400).json({
        success: false,
        message: result.message || "Invalid OTP",
      });
    }

  } catch (error) {
    console.log("Verify OTP error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Invalid or expired OTP",
    });
  }
};

export const resendOtp = async (req, res) => {
  try {
    const { phoneNo } = req.body;

    if (!phoneNo) {
      return res.status(400).json({
        success: false,
        message: "Phone number is required",
      });
    }

    const result = await msg91Retry(phoneNo);
    console.log("MSG91 retry response:", result);

    if (result.type === "success") {
      return res.status(200).json({
        success: true,
        message: "OTP resent successfully",
      });
    } else {
      return res.status(400).json({
        success: false,
        message: result.message || "Failed to resend OTP",
      });
    }

  } catch (error) {
    console.log("Resend OTP error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

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


