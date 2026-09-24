import { Cart } from "../models/cartModel.js";
import { Product } from "../models/productModel.js";

export const getCart = async (req, res) => {
  try {
    const userId = req.id;

    let cart = await Cart.findOne({ userId }).populate("items.productId");

    if (!cart) {
      return res.json({
        success: true,
        cart: {
          items: [],
          totalPrice: 0,
        },
      });
    }

    // ❌ Deleted products remove karo
    cart.items = cart.items.filter((item) => item.productId);

    // ✅ Total dubara calculate karo
    cart.totalPrice = cart.items.reduce(
      (acc, item) => acc + item.price * item.quantity,
      0
    );

    await cart.save();

    res.status(200).json({
      success: true,
      cart,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const addToCart = async (req, res) => {
  try {
    const userId = req.id;
    const { productId } = req.body;

    // check if product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // find the user's cart (if exists)
    let cart = await Cart.findOne({ userId });

    // If cart doesn't exists, create a new one
    if (!cart) {
      cart = new Cart({
        userId,
        items: [{ productId, quantity: 1, price: product.productPrice }],
        totalPrice: product.productPrice,
      });
    } else {
      // Find if product is already in the cart
      const itemIndex = cart.items.findIndex(
        (item) => item.productId.toString() === productId
      );

      if (itemIndex > -1) {
        // if product exists -> just increase quantity
        cart.items[itemIndex].quantity += 1;
      } else {
        // if new product -> push to cart
        cart.items.push({
          productId,
          quantity: 1,
          price: product.productPrice,
        });
      }

      // Recalculate total price
      cart.totalPrice = cart.items.reduce(
        (acc, item) => acc + item.price * item.quantity,
        0
      );
    }

    // Save updated cart
    await cart.save();

    // Populate product details before sending response
    const populatedCart = await Cart.findById(cart._id).populate("items.productId");

    res.status(200).json({
      success: true,
      message: "Product added to cart",
      cart: populatedCart,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const updateQuantity = async (req, res) => {
  try {
    const userId = req.id;
    const { productId, type } = req.body;

    let cart = await Cart.findOne({ userId });
    if (!cart) return res.status(404).json({ success: false, message: "Cart not found" });

    const item = cart.items.find(item => item.productId.toString() === productId);
    if (!item) return res.status(404).json({ success: false, message: "Item not found" });

    if (type === "increase") item.quantity += 1;
    if (type === "decrease" && item.quantity > 1) item.quantity -= 1;

    cart.totalPrice = cart.items.reduce((acc, item) => acc + item.price * item.quantity, 0);


    await cart.save();
    cart = await cart.populate("items.productId");


    res.status(200).json({
      success: true,
      message: "Cart updated successfully",
      cart
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const removeFromCart = async (req, res) => {
  try {
    const userId = req.id;
    const { productId } = req.body;

    let cart = await Cart.findOne({ userId });
    if (!cart) return res.status(404).json({
      success: false,
      message: "Cart not found"
    });

    cart.items = cart.items.filter((item) => {
      if (!item.productId) return false;

      return item.productId.toString() !== productId;
    });
    cart.totalPrice = cart.items.reduce((acc, item) => acc + item.price * item.quantity, 0);

    await cart.save();
    cart = await cart.populate("items.productId");
    res.status(200).json({
      success: true,
      cart
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};