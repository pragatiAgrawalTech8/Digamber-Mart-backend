const express = require('express');
const router = express.Router();
const { sendOtp, verifyOtp, retryOtp } = require('../services/otpService');

// पंजीकरण करते समय OTP भेजें
router.post('/send-otp', async (req, res) => {
  try {
    const { mobile } = req.body;
    if (!mobile) {
      return res.status(400).json({ success: false, message: 'मोबाइल नंबर प्रदान करें' });
    }

    // सुनिश्चित करें कि मोबाइल नंबर में देश कोड है (भारत के लिए 91 जोड़ें)
    const formattedMobile = mobile.startsWith('91') ? mobile : `91${mobile}`;

    const result = await sendOtp(formattedMobile);

    if (result.type === 'success') {
      res.json({ success: true, message: 'OTP सफलतापूर्वक भेजा गया' });
    } else {
      res.status(400).json({ success: false, message: result.message || 'OTP भेजना विफल रहा' });
    }
  } catch (error) {
    console.error('OTP भेजने में त्रुटि:', error);
    res.status(500).json({ success: false, message: 'सर्वर त्रुटि' });
  }
});

// OTP सत्यापित करें
router.post('/verify-otp', async (req, res) => {
  try {
    const { mobile, otp } = req.body;
    if (!mobile || !otp) {
      return res.status(400).json({ success: false, message: 'मोबाइल नंबर और OTP प्रदान करें' });
    }

    const formattedMobile = mobile.startsWith('91') ? mobile : `91${mobile}`;
    const result = await verifyOtp(formattedMobile, otp);

    if (result.type === 'success') {
      // OTP सत्यापन सफल, यहाँ उपयोगकर्ता की सत्यापन स्थिति अपडेट करें आदि
      res.json({ success: true, message: 'OTP सत्यापन सफल' });
    } else {
      res.status(400).json({ success: false, message: result.message || 'OTP सत्यापन विफल' });
    }
  } catch (error) {
    console.error('OTP सत्यापन में त्रुटि:', error);
    res.status(500).json({ success: false, message: 'सर्वर त्रुटि' });
  }
});

// OTP फिर से भेजें
router.post('/retry-otp', async (req, res) => {
  try {
    const { mobile } = req.body;
    if (!mobile) {
      return res.status(400).json({ success: false, message: 'मोबाइल नंबर प्रदान करें' });
    }

    const formattedMobile = mobile.startsWith('91') ? mobile : `91${mobile}`;
    const result = await retryOtp(formattedMobile, false); // डिफ़ॉल्ट रूप से टेक्स्ट द्वारा फिर से भेजें

    if (result.type === 'success') {
      res.json({ success: true, message: 'OTP फिर से भेजा गया' });
    } else {
      res.status(400).json({ success: false, message: result.message || 'फिर से भेजना विफल रहा' });
    }
  } catch (error) {
    console.error('OTP फिर से भेजने में त्रुटि:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;