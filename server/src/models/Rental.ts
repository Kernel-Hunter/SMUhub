import { Schema, model } from 'mongoose'

/** An item a student lends to classmates. No money moves through SMUhub: price and deposit are only shown. */
const rentalItemSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 80 },
    category: { type: String, enum: ['calculator', 'lab', 'books', 'tech', 'other'], required: true },
    pricePerDay: { type: Number, required: true, min: 0, max: 200 },
    deposit: { type: Number, required: true, min: 0, max: 2000 },
    condition: { type: String, enum: ['new', 'good', 'worn'], required: true },
    description: { type: String, trim: true, maxlength: 400, default: '' },
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    // Private: only revealed to a renter once the owner accepts. select: false keeps it out of every
    // query unless asked for with .select('+contact').
    contact: { type: String, required: true, trim: true, maxlength: 80, select: false },
    available: { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false },
)

/** A student's request to borrow an item. `owner` is copied from the item so "requests for my items" is one query. */
const rentalRequestSchema = new Schema(
  {
    item: { type: Schema.Types.ObjectId, ref: 'RentalItem', required: true, index: true },
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    renter: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    from: { type: Date, required: true },
    to: { type: Date, required: true },
    note: { type: String, trim: true, maxlength: 200, default: '' },
    status: { type: String, enum: ['pending', 'accepted', 'declined', 'returned'], default: 'pending' },
  },
  { timestamps: true, versionKey: false },
)
// One open (pending or accepted) request per student and item, even with parallel clicks.
rentalRequestSchema.index({ item: 1, renter: 1 }, { unique: true, partialFilterExpression: { status: { $in: ['pending', 'accepted'] } } })

export const RentalItem = model('RentalItem', rentalItemSchema)
export const RentalRequest = model('RentalRequest', rentalRequestSchema)
