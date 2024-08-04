import mongoose , {Schema , model} from "mongoose";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";

const likeSchema = new Schema({
    video : {
        type : Schema.Types.ObjectId ,
        ref : "Video",
        default : null
    },
    comment : {
        type : Schema.Types.ObjectId ,
        ref : "Comment",
        default : null
    },
    likedBy : {
        type : Schema.Types.ObjectId ,
        ref : "User",
        required : true
    },
    tweet : {
        type : Schema.Types.ObjectId ,
        ref : "Tweet",
        default : null
    }
    
},{timestamps : true})

export const Like = model("Like" , likeSchema)