import { Schema, model } from "mongoose";

const replySchema = new Schema(
  {
    thread: {
      type: Schema.Types.ObjectId,
      ref: "Thread",
      required: true,
      index: true,
    },
    body: { type: String, required: true, trim: true, maxlength: 5000 },
    author: { type: Schema.Types.ObjectId, ref: "User", required: true },
    anonymous: { type: Boolean, default: false },
    voters: [{ type: Schema.Types.ObjectId, ref: "User" }],
    accepted: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export const Reply = model("Reply", replySchema);
