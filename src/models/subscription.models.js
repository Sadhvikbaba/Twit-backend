import { model, Schema} from "mongoose";

const subscriptionSchema = new Schema({
    subscriber : {
        type : Schema.Types.ObjectId, // subscriber
        ref : "User"
    },
    channel : {
        type : Schema.Types.ObjectId, // subscribing
        ref : "User"
    }
},{timestamps : true})

export const Subscription = model("Subscription" , subscriptionSchema)