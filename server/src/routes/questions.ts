import { Router } from "express";
import { isValidObjectId } from "mongoose";
import { z } from "zod";
import type { Config } from "../config/env.js";
import { HttpError } from "../lib/errors.js";
import { Thread } from "../models/Thread.js";
import { Reply } from "../models/Reply.js";
import { User } from "../models/User.js";

const newThreadBody = z.object({
  title: z.string().trim().min(5).max(200),
  body: z.string().trim().min(10).max(5000),
  courseCode: z.string().trim().max(20).optional(),
  anonymous: z.boolean().optional(),
});

const newReplyBody = z.object({
  body: z.string().trim().min(2).max(5000),
  anonymous: z.boolean().optional(),
});

const NOT_FOUND = "Question introuvable.";
const REPLY_NOT_FOUND = "Réponse introuvable.";

type Id = { toString(): string };
type ClientAuthor = {
  id: string;
  name: string;
  handle: string;
  major: string;
  year: number;
};

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** The author shape the client expects (see client/src/api/types.ts). No email is exposed. */
function toClientAuthor(u: {
  _id: Id;
  firstName: string;
  lastName: string;
  email: string;
  major?: string | null;
  year?: number | null;
}): ClientAuthor {
  return {
    id: u._id.toString(),
    name: `${u.firstName} ${u.lastName}`,
    handle: u.email.split("@")[0],
    major: u.major ?? "",
    year: u.year ?? 1,
  };
}

async function loadAuthors(ids: Id[]) {
  const unique = [...new Set(ids.map((i) => i.toString()))];
  const users = await User.find({ _id: { $in: unique } });
  return new Map(users.map((u) => [u._id.toString(), toClientAuthor(u)]));
}

function threadJson(t: any, meId: Id, authors: Map<string, ClientAuthor>) {
  const authorId = t.author.toString();
  return {
    id: t._id.toString(),
    kind: t.kind,
    title: t.title,
    body: t.body,
    courseCode: t.courseCode,
    author: t.anonymous ? null : (authors.get(authorId) ?? null),
    mine: authorId === meId.toString(),
    createdAt: t.createdAt.getTime(),
    votes: t.voters.length,
    iVoted: t.voters.some((v: any) => v.equals(meId)),
    replyCount: t.replyCount,
    solved: t.solved,
  };
}

function replyJson(r: any, meId: Id, authors: Map<string, ClientAuthor>) {
  const authorId = r.author.toString();
  return {
    id: r._id.toString(),
    threadId: r.thread.toString(),
    body: r.body,
    author: r.anonymous ? null : (authors.get(authorId) ?? null),
    mine: authorId === meId.toString(),
    createdAt: r.createdAt.getTime(),
    votes: r.voters.length,
    iVoted: r.voters.some((v: any) => v.equals(meId)),
    accepted: r.accepted,
  };
}

export function questionsRouter(_config: Config) {
  const router = Router();

  // US-10: browse and search  (GET /api/questions?q=keyword&course=CS101)
  router.get("/", async (req, res) => {
    const me = req.user!;
    const filter: Record<string, unknown> = { kind: "question" };
    if (typeof req.query.course === "string" && req.query.course.trim()) {
      filter.courseCode = req.query.course.trim().toUpperCase();
    }
    if (typeof req.query.q === "string" && req.query.q.trim()) {
      const rx = new RegExp(escapeRegex(req.query.q.trim()), "i");
      filter.$or = [{ title: rx }, { body: rx }];
    }
    const threads = await Thread.find(filter).sort({ createdAt: -1 }).limit(50);
    const authors = await loadAuthors(threads.map((t) => t.author));
    res.json({ threads: threads.map((t) => threadJson(t, me._id, authors)) });
  });

  // US-09: ask a question  (POST /api/questions)
  router.post("/", async (req, res) => {
    const me = req.user!;
    const parsed = newThreadBody.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(
        400,
        "invalid_input",
        "Titre (5 caractères min.) et description (10 caractères min.) sont obligatoires.",
      );
    }
    const thread = await Thread.create({
      ...parsed.data,
      kind: "question",
      author: me._id,
    });
    const authors = await loadAuthors([me._id]);
    res.status(201).json({ thread: threadJson(thread, me._id, authors) });
  });

  // US-15: upvote a reply (toggle)  (POST /api/questions/replies/:replyId/vote)
  router.post("/replies/:replyId/vote", async (req, res) => {
    const me = req.user!;
    if (!isValidObjectId(req.params.replyId))
      throw new HttpError(404, "not_found", REPLY_NOT_FOUND);
    const reply = await Reply.findById(req.params.replyId);
    if (!reply) throw new HttpError(404, "not_found", REPLY_NOT_FOUND);
    const has = reply.voters.some((v) => v.equals(me._id));
    await Reply.updateOne(
      { _id: reply._id },
      has ? { $pull: { voters: me._id } } : { $addToSet: { voters: me._id } },
    );
    const fresh = await Reply.findById(reply._id);
    const authors = await loadAuthors([fresh!.author]);
    res.json({ reply: replyJson(fresh, me._id, authors) });
  });

  // US-16: accept an answer, only the question's author can  (POST /api/questions/replies/:replyId/accept)
  router.post("/replies/:replyId/accept", async (req, res) => {
    const me = req.user!;
    if (!isValidObjectId(req.params.replyId))
      throw new HttpError(404, "not_found", REPLY_NOT_FOUND);
    const reply = await Reply.findById(req.params.replyId);
    if (!reply) throw new HttpError(404, "not_found", REPLY_NOT_FOUND);
    const thread = await Thread.findById(reply.thread);
    if (!thread) throw new HttpError(404, "not_found", NOT_FOUND);
    if (!thread.author.equals(me._id)) {
      throw new HttpError(
        403,
        "forbidden",
        "Seul l'auteur de la question peut accepter une réponse.",
      );
    }
    const accept = !reply.accepted; // clicking again un-accepts
    await Reply.updateMany({ thread: thread._id }, { accepted: false });
    if (accept) await Reply.updateOne({ _id: reply._id }, { accepted: true });
    await Thread.updateOne({ _id: thread._id }, { solved: accept });
    const fresh = await Reply.findById(reply._id);
    const authors = await loadAuthors([fresh!.author]);
    res.json({ reply: replyJson(fresh, me._id, authors), solved: accept });
  });

  // One question with its answers  (GET /api/questions/:id)
  router.get("/:id", async (req, res) => {
    const me = req.user!;
    if (!isValidObjectId(req.params.id))
      throw new HttpError(404, "not_found", NOT_FOUND);
    const thread = await Thread.findById(req.params.id);
    if (!thread) throw new HttpError(404, "not_found", NOT_FOUND);
    const replies = await Reply.find({ thread: thread._id }).sort({
      accepted: -1,
      createdAt: 1,
    });
    const authors = await loadAuthors([
      thread.author,
      ...replies.map((r) => r.author),
    ]);
    res.json({
      thread: threadJson(thread, me._id, authors),
      replies: replies.map((r) => replyJson(r, me._id, authors)),
    });
  });

  // US-15: upvote a question (toggle)  (POST /api/questions/:id/vote)
  router.post("/:id/vote", async (req, res) => {
    const me = req.user!;
    if (!isValidObjectId(req.params.id))
      throw new HttpError(404, "not_found", NOT_FOUND);
    const thread = await Thread.findById(req.params.id);
    if (!thread) throw new HttpError(404, "not_found", NOT_FOUND);
    const has = thread.voters.some((v) => v.equals(me._id));
    await Thread.updateOne(
      { _id: thread._id },
      has ? { $pull: { voters: me._id } } : { $addToSet: { voters: me._id } },
    );
    const fresh = await Thread.findById(thread._id);
    const authors = await loadAuthors([fresh!.author]);
    res.json({ thread: threadJson(fresh, me._id, authors) });
  });

  // US-11: answer a question  (POST /api/questions/:id/replies)
  router.post("/:id/replies", async (req, res) => {
    const me = req.user!;
    if (!isValidObjectId(req.params.id))
      throw new HttpError(404, "not_found", NOT_FOUND);
    const parsed = newReplyBody.safeParse(req.body);
    if (!parsed.success)
      throw new HttpError(400, "invalid_input", "La réponse est trop courte.");
    const thread = await Thread.findById(req.params.id);
    if (!thread) throw new HttpError(404, "not_found", NOT_FOUND);
    const reply = await Reply.create({
      ...parsed.data,
      thread: thread._id,
      author: me._id,
    });
    await Thread.updateOne({ _id: thread._id }, { $inc: { replyCount: 1 } });
    const authors = await loadAuthors([me._id]);
    res.status(201).json({ reply: replyJson(reply, me._id, authors) });
  });

  return router;
}
