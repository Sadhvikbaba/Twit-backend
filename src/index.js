import dotenv from "dotenv"
import { app } from "./app.js";
import connectDB from "./db/index.js";
import { sendMail } from "./utils/mail.js";

dotenv.config({
    path: '.env'
})

connectDB()
.then(() => {
    app.listen(process.env.PORT || 8000 , () => {
        console.log(`server is running on https://localhost:${process.env.PORT}`);
    })
}).catch((err) => {
    console.log("Mongo DB connection failed :",err);
})


/*
app.listen(port , () => {
    console.log(`server runs at http://localhost:${port}`)
})
*/


/*
import  express from "express";

const app = express()

;( async () => {
    try {
        await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`)
        app.on("error" , (error) => {
            console.log("error :", error);
            throw error
        })

        app.listen(process.env.PORT , () => {
            console.log(`app is listeing on port ${process.env.PORT}`;)
        })
    } catch (error) {
        console.error("ERROR : " , error)
    }
})  ()

*/

//url request = req.params
//body request = req.body -> json