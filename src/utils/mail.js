import nodemailer from "nodemailer";

export const sendMail = (to , text) => {

    let transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
        user: process.env.EMAIL,
        pass: process.env.EMAIL_PASSWORD,
        }
    });

    var mailOptions = {
        from: process.env.EMAIL,
        to: to,
        subject: 'Twit app',
        text: text
    };

    let value;

    transporter.sendMail(mailOptions, function(error, info){
        if (error) {
            value = false
        } else {
            value = true
        }
    });
    return value;
}