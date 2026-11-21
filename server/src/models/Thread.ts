import { Schema, model } from "mongoose";

const threadSchema = new Schema(
  {
    kind: {
      type: String,
      enum: ["question", "voice"],
      default: "question",
      index: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    body: { type: String, required: true, trim: true, maxlength: 5000 },
    courseCode: { type: String, trim: true, uppercase: true, index: true },
    author: { type: Schema.Types.ObjectId, ref: "User", required: true },
    anonymous: { type: Boolean, default: false },
    voters: [{ type: Schema.Types.ObjectId, ref: "User" }],
    replyCount: { type: Number, default: 0 },
    solved: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export const Thread = model("Thread", threadSchema);
