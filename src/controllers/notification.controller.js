import User from "../models/User.js";
import { sendMessageToUser } from "../utils/notifier.js";
import { ROLES } from '../utils/constants.js';
import NotificationHistory from "../models/NotificationHistory.js";



// 1️⃣ Send to a single user
// export async function sendToSingleUser(req, res, next) {
//   try {
//     const { userId, channel, subject, message } = req.body;

//     // Only SUPER_ADMIN or AGENCY_ADMIN can send
//     if (![ROLES.SUPER_ADMIN, ROLES.AGENCY_ADMIN].includes(req.user.role)) {
//       return res.status(403).json({ message: "Not allowed" });
//     }

//     const user = await User.findById(userId);
//     if (!user) return res.status(404).json({ message: "User not found" });

//     // If agency admin, make sure the user is in the same agency
//     if (
//       req.user.role === ROLES.AGENCY_ADMIN &&
//       String(user.agency) !== String(req.user.agency)
//     ) {
//       return res
//         .status(403)
//         .json({ message: "Cannot send message to another agency's user" });
//     }

//     await sendMessageToUser(user, { channel, subject, text: message });

//     res.json({ message: "Message sent to user" });
//   } catch (err) {
//     next(err);
//   }
// }

export async function sendToSingleUser(req, res, next) {
  try {
    const { userId, channel, subject, message } = req.body;
   const sender = req.user?._id || process.env.SYSTEM_SENDER || null;
    if (!sender) return res.status(400).json({ message: 'Sender is required' });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Send the message
    let status = "sent";
    try {
      await sendMessageToUser(user, { channel, subject, text: message });
    } catch (err) {
      console.error(err);
      status = "failed";
    }

    // Save to history
    await NotificationHistory.create({
      sender,
      recipients: [{ user: user._id, channel, status }],
      channel,
      subject,
      message,
      scope: "single",
      agency: user.agency,
    });

    res.json({ message: "Message sent to user", status });
  } catch (err) {
    next(err);
  }
}


// 2️⃣ Broadcast to ALL users (SUPER_ADMIN only)
// export async function broadcastMessage(req, res, next) {
//   try {
//     const { channel, subject, message } = req.body;

//     if (req.user.role !== ROLES.SUPER_ADMIN) {
//       return res
//         .status(403)
//         .json({ message: "Only SUPER_ADMIN can broadcast to all users" });
//     }

//     const users = await User.find({}); // all users (max 80 in your system)

//     await Promise.all(
//       users.map((u) =>
//         sendMessageToUser(u, { channel, subject, text: message }).catch((err) =>
//           console.error(
//             `Failed to send to ${u.email || u.phone}:`,
//             err.message
//           )
//         )
//       )
//     );

//     res.json({ message: `Broadcast sent to ${users.length} users` });
//   } catch (err) {
//     next(err);
//   }
// }

export async function broadcastMessage(req, res, next) {
  try {
    const { channel, subject, message } = req.body;
    
    const sender = req.user?._id || process.env.SYSTEM_SENDER || null;
    if (!sender) return res.status(400).json({ message: 'Sender is required' });
 
    const users = await User.find({});

    const recipients = [];

    await Promise.all(
      users.map(async (u) => {
        let status = "sent";
        try {
          await sendMessageToUser(u, { channel, subject, text: message });
        } catch (err) {
          status = "failed";
        }
        recipients.push({ user: u._id, channel, status });
      })
    );

    // Save to history
    await NotificationHistory.create({
      sender,
      recipients,
      channel,
      subject,
      message,
      scope: "broadcast",
    });

    res.json({ message: `Broadcast sent to ${users.length} users` });
  } catch (err) {
    next(err);
  }
}


// 3️⃣ Send to one agency's users
// export async function notifyAgency(req, res, next) {
//   try {
//     const { agencyId, channel, subject, message } = req.body;

//     // SUPER_ADMIN can send to any agency
//     // AGENCY_ADMIN can only send to *their* agency
//     if (req.user.role === ROLES.AGENCY_ADMIN) {
//       if (String(req.user.agency) !== String(agencyId)) {
//         return res
//           .status(403)
//           .json({ message: "Cannot send to another agency" });
//       }
//     } else if (req.user.role !== ROLES.SUPER_ADMIN) {
//       return res
//         .status(403)
//         .json({ message: "Not allowed to send agency notifications" });
//     }

//     const users = await User.find({ agency: agencyId });

//     await Promise.all(
//       users.map((u) =>
//         sendMessageToUser(u, { channel, subject, text: message }).catch((err) =>
//           console.error(
//             `Failed to send to ${u.email || u.phone}:`,
//             err.message
//           )
//         )
//       )
//     );

//     res.json({
//       message: `Notification sent to ${users.length} users in the agency`,
//     });
//   } catch (err) {
//     next(err);
//   }
// }

export async function notifyAgency(req, res, next) {
  try {
    const { agencyId, channel, subject, message } = req.body;
    
      const sender = req.user?._id || process.env.SYSTEM_SENDER || null;
    if (!sender) return res.status(400).json({ message: 'Sender is required' });



    const users = await User.find({ agency: agencyId });
    
    const recipients = [];

    await Promise.all(
      users.map(async (u) => {
        let status = "sent";
        try {
          await sendMessageToUser(u, { channel, subject, text: message });
        } catch (err) {
          status = "failed";
        }
        recipients.push({ user: u._id, channel, status });
      })
    );

    // Save history
    await NotificationHistory.create({
      sender,
      recipients,
      channel,
      subject,
      message,
      scope: "agency",
      agency: agencyId,
    });

    res.json({
      message: `Agency notification sent to ${users.length} users`,
    });
  } catch (err) {
    next(err);
  }
}
