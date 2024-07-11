import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import {z} from 'zod'
import { prisma } from "../lib/prisma";
import dayjs, { Dayjs } from "dayjs";
import localizedFormat from 'dayjs/plugin/localizedFormat'
import 'dayjs/locale/pt-br'
import { getMailClient } from "../lib/mail";
import nodemailer from 'nodemailer';

dayjs.locale('pt-br')
dayjs.extend(localizedFormat)

export async function createTrip(app: FastifyInstance) {

    app.withTypeProvider<ZodTypeProvider>().post('/trips',{
        schema:{
            body: z.object({
                destination: z.string().min(4),
                starts_at: z.coerce.date(),
                ends_at: z.coerce.date(),
                owner_name: z.string(),
                owner_email: z.string().email(),
                emails_to_invite: z.array(z.string().email())
        })
    },
    }, async (resquest)=>{
        const{destination, starts_at, ends_at, owner_email, owner_name, emails_to_invite} = resquest.body

        if(dayjs(starts_at).isBefore(new Date())){
            throw new Error("The start date must be in the future")
        }

        if(dayjs(ends_at).isBefore(starts_at)){
            throw new Error("The end date must be after the start date")
        }

        const trip = await prisma.trip.create({
            data: {
                destination,
                starts_at,
                ends_at,
                participants: {
                    createMany: {
                        data:[
                              {
                                email: owner_email,
                                name: owner_name,
                                is_owner: true,
                                is_confirmed: true
                            },
                            ...emails_to_invite.map(email=>({
                                email
                            }))
                        ],
                    }
                }
            }
        })

        const FormattedStartDate = dayjs(starts_at).format('LL')
        const FormattedEndDate = dayjs(ends_at).format('LL')

        const confirmationLink = 'http://localhost:3333/trips/${trip.id}/confirm'

        const mail = await getMailClient()

        const message = await mail.sendMail({
            from: {
                name: "Trip Planner",
                address: "teste@galo.com"
            },
            to:{
                name: owner_name,
                address: owner_email
            },
            
            subject: "Confirme sua viagem para ${destination} em ${FormattedStartDate}",
            html: `<div>
            <p> Voce solicitou a criação de uma viagem para ${destination} nas datas de ${FormattedStartDate} até ${FormattedEndDate}</p>
            <p></p>
            <p>Para confirmar sua viagem, clique no link abaixo:</p>
            <p></p>
            <a href="${confirmationLink}">Confirmar Viagem</a>
            </div>`.trim()
        })

        console.log(nodemailer.getTestMessageUrl(message))

        return  { tripId: trip.id}
})
}
