import { Product } from "../models/productModel.js";
import supabase from "../utils/supabase.js";
import { v4 as uuidv4 } from "uuid";

const BUCKET_NAME = "product-images";

// Helper function to upload a single file to Supabase Storage
const uploadToSupabase = async (file) => {
  const fileExt = file.originalname.split(".").pop();
  const fileName = `${uuidv4()}.${fileExt}`;
  const filePath = `mern_products/${fileName}`;

  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(filePath, file.buffer, {
      contentType: file.mimetype,
      upsert: false,
    });

  if (error) {
    // Detect storage-full / quota errors specifically
    const msg = error.message?.toLowerCase() || "";
    if (
      msg.includes("exceeded") ||
      msg.includes("quota") ||
      msg.includes("payload too large") ||
      msg.includes("max_file_size") ||
      error.statusCode === "413"
    ) {
      const quotaError = new Error(
        "Storage limit reached. Please contact admin or free up space to upload more images."
      );
      quotaError.isQuotaError = true;
      throw quotaError;
    }
    throw new Error(`Image upload failed: ${error.message}`);
  }

  const { data: publicUrlData } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(filePath);

  return {
    url: publicUrlData.publicUrl,
    public_id: filePath,
  };
};

// Helper function to delete a file from Supabase Storage
const deleteFromSupabase = async (filePath) => {
  try {
    const { error } = await supabase.storage.from(BUCKET_NAME).remove([filePath]);
    if (error) {
      console.log("Delete error:", error);
    }
  } catch (err) {
    console.log("Unexpected delete error:", err);
  }
};

export const addProduct = async (req, res) => {
  console.log("🔥 addProduct called");
  try {
    const { productName, productDesc, productPrice, category, brand } = req.body;

    const userId = req.id;

    if (!productName || !productDesc || !productPrice || !category || !brand) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    // Handle multiple image uploads
    let productImg = [];

    if (req.files && req.files.length > 0) {
      for (let file of req.files) {
        try {
          const uploaded = await uploadToSupabase(file);
          productImg.push(uploaded);
        } catch (uploadError) {
          console.log("Upload error:", uploadError);

          // Storage-full / quota specific response
          if (uploadError.isQuotaError) {
            return res.status(507).json({
              success: false,
              message: uploadError.message,
            });
          }

          return res.status(500).json({
            success: false,
            message: "Failed to upload one or more images. Please try again.",
          });
        }
      }
    }
    console.log({
  userId,
  productName,
  productDesc,
  productPrice,
  category,
  brand,
  productImg,
});
    // create a product in DB
    const newProduct = await Product.create({
      userId,
      productName,
      productDesc,
      productPrice,
      category,
      brand,
      productImg,
    });
console.log("Saved Product:", newProduct);
    return res.status(200).json({
      success: true,
      message: "Product added successfully",
      product: newProduct,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getAllProduct = async (_, res) => {
  try {
    const products = await Product.find();

    if (!products) {
      return res.status(404).json({
        success: false,
        message: "No product available",
        products: [],
      });
    }

    return res.status(200).json({
      success: true,
      products,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const deleteProduct = async (req, res) => {
  try {
    const { productId } = req.params;

    const product = await Product.findById(productId);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // Delete images from Supabase Storage
    if (product.productImg && product.productImg.length > 0) {
      for (let img of product.productImg) {
        await deleteFromSupabase(img.public_id);
      }
    }

    // Delete product from MongoDB
    await Product.findByIdAndDelete(productId);

    return res.status(200).json({
      success: true,
      message: "Product deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const updateProduct = async (req, res) => {
  try {
    const { productId } = req.params;
    const {
      productName,
      productDesc,
      productPrice,
      category,
      brand,
      existingImages,
    } = req.body;

    const product = await Product.findById(productId);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    let updatedImages = [];

    // Keep selected old images
    if (existingImages) {
      const keepIds = JSON.parse(existingImages);

      updatedImages = product.productImg.filter((img) =>
        keepIds.includes(img.public_id)
      );

      const removedImages = product.productImg.filter(
        (img) => !keepIds.includes(img.public_id)
      );

      for (let img of removedImages) {
        await deleteFromSupabase(img.public_id);
      }
    } else {
      updatedImages = product.productImg;
    }

    // Upload new images if any
    if (req.files && req.files.length > 0) {
      for (let file of req.files) {
        try {
          const uploaded = await uploadToSupabase(file);
          updatedImages.push(uploaded);
        } catch (uploadError) {
          console.log("Upload error:", uploadError);

          if (uploadError.isQuotaError) {
            return res.status(507).json({
              success: false,
              message: uploadError.message,
            });
          }

          return res.status(500).json({
            success: false,
            message: "Failed to upload one or more images. Please try again.",
          });
        }
      }
    }

    // Update product
    product.productName = productName || product.productName;
    product.productDesc = productDesc || product.productDesc;
    product.productPrice = productPrice || product.productPrice;
    product.category = category || product.category;
    product.brand = brand || product.brand;
    product.productImg = updatedImages;

    await product.save();

    return res.status(200).json({
      success: true,
      message: "Product updated successfully",
      product,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};



// import { Product } from "../models/productModel.js";
// import cloudinary from "../utils/cloudinary.js";
// import getDataUri from "../utils/dataUri.js";

// export const addProduct = async (req, res) => {
//   console.log("🔥 addProduct called")
//     try {
//         const {
//             productName,
//             productDesc,
//             productPrice,
//             category,
//             brand,
//         } = req.body;

//         const userId = req.id;

//         if (
//             !productName ||
//             !productDesc ||
//             !productPrice ||
//             !category ||
//             !brand
//         ) {
//             return res.status(400).json({
//                 success: false,
//                 message: "All fields are required",
//             });
//         }

//         // Handle multiple image uploads
//         let productImg = [];

//         if (req.files && req.files.length > 0) {
//             for (let file of req.files) {
//                 const fileUri = getDataUri(file)
//                 const result = await cloudinary.uploader.upload(fileUri, {
//                     folder: "mern_products" //cloudinary folder name
//                 })
//                 productImg.push({
//                     url: result.secure_url,
//                     public_id: result.public_id
//                 })
//             }
//         }
//         // create a product in DB
//         const newProduct = await Product.create({
//             userId,
//             productName,
//             productDesc,
//             productPrice,
//             category,
//             brand,
//             productImg, // array of objects [{ url, public_id }, { url, public_id }]
//         });

//         return res.status(200).json({
//             success: true,
//             message: "Product added successfully",
//             product: newProduct,
//         });
//     } catch (error) {
//       console.log(error)
//         return res.status(500).json({
//             success: false,
//             message: error.message,
//         });
//     }
// };

// export const getAllProduct = async (_, res) => {
//     try {
//         const products = await Product.find();

//         if (!products) {
//             return res.status(404).json({
//                 success: false,
//                 message: "No product available",
//                 products: [],
//             });
//         }

//         return res.status(200).json({
//             success: true,
//             products,
//         });
//     } catch (error) {
//         return res.status(500).json({
//             success: false,
//             message: error.message,
//         });
//     }
// };


// export const deleteProduct = async (req, res) => {
//   try {
//     const { productId } = req.params;

//     const product = await Product.findById(productId);

//     if (!product) {
//       return res.status(404).json({
//         success: false,
//         message: "Product not found",
//       });
//     }

//     // Delete images from Cloudinary
//     if (product.productImg && product.productImg.length > 0) {
//       for (let img of product.productImg) {
//         await cloudinary.uploader.destroy(img.public_id);
//       }
//     }

//     // Delete product from MongoDB
//     await Product.findByIdAndDelete(productId);

//     return res.status(200).json({
//       success: true,
//       message: "Product deleted successfully",
//     });
//   } catch (error) {
//     return res.status(500).json({
//       success: false,
//       message: error.message,
//     });
//   }
// };

// export const updateProduct = async (req, res) => {
//   try {
//     const { productId } = req.params;
//     const {
//       productName,
//       productDesc,
//       productPrice,
//       category,
//       brand,
//       existingImages,
//     } = req.body;

//     const product = await Product.findById(productId);

//     if (!product) {
//       return res.status(404).json({
//         success: false,
//         message: "Product not found",
//       });
//     }

//     let updatedImages = [];

//     // Keep selected old images
//     if (existingImages) {
//       const keepIds = JSON.parse(existingImages);

//       updatedImages = product.productImg.filter((img) =>
//         keepIds.includes(img.public_id)
//       );

//       // Delete only removed images
//       const removedImages = product.productImg.filter(
//         (img) => !keepIds.includes(img.public_id)
//       );

//       for (let img of removedImages) {
//         await cloudinary.uploader.destroy(img.public_id);
//       }
//     } else {
//       // Keep all images if nothing sent
//       updatedImages = product.productImg;
//     }

//     // Upload new images if any
//     if (req.files && req.files.length > 0) {
//       for (let file of req.files) {
//         const fileUri = getDataUri(file);

//         const result = await cloudinary.uploader.upload(fileUri, {
//           folder: "mern_products",
//         });

//         updatedImages.push({
//           url: result.secure_url,
//           public_id: result.public_id,
//         });
//       }
//     }

//     // Update product
//     product.productName = productName || product.productName;
//     product.productDesc = productDesc || product.productDesc;
//     product.productPrice = productPrice || product.productPrice;
//     product.category = category || product.category;
//     product.brand = brand || product.brand;
//     product.productImg = updatedImages;

//     await product.save();

//     return res.status(200).json({
//       success: true,
//       message: "Product updated successfully",
//       product,
//     });
//   } catch (error) {
//     return res.status(500).json({
//       success: false,
//       message: error.message,
//     });
//   }
// };