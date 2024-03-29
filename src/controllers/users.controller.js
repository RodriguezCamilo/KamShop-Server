import { userModel } from "../models/users.models.js"
import { sendRecoveryMail } from "../config/nodemailer.js"
import { createHash } from '../utils/bcrypt.js'
import {deletedUser} from '../config/nodemailer.js'
import crypto from 'crypto'

export const getUsers = async (req, res) => {
    const { limit } = req.query

    try {
        const users = await userModel.find().limit(limit)
        res.status(200).send({ respuesta: 'OK', mensaje: users })
    } catch (error) {
        res.status(400).send({ respuesta: 'Error en consultar usuarios', mensaje: error })
    }
}

export const getUsersLimited = async (req, res) => {
    const { limit } = req.query

    try {
        const users = await userModel.find({}, 'firstName email rol').limit(limit)
        res.status(200).send({ respuesta: 'OK', mensaje: users })
    } catch (error) {
        res.status(400).send({ respuesta: 'Error en consultar usuarios', mensaje: error })
    }
}

export const getUser = async (req, res) => {
    const { id } = req.params

    try {
        const user = await userModel.findById(id)
        if (user) {

            res.status(200).send({ respuesta: 'OK', mensaje: user })
        } else {
            res.status(404).send({ respuesta: 'Error', mensaje: 'Not Found' })
        }
    } catch (error) {
        res.status(400).send({ respuesta: 'Error en consultar usuarios', mensaje: error })
    }
}

export const putUser = async (req, res) => {
    const { id } = req.params
    const { firstName, lastName, age, email, password } = req.body

    try {
        const user = await userModel.findByIdAndUpdate(id, { firstName, lastName, age, email, password })
        if (user) {
            res.status(200).send({ respuesta: 'OK', mensaje: user })
        } else {
            res.status(404).send({ respuesta: 'Error', mensaje: 'Not Found' })
        }

    } catch (error) {
        res.status(400).send({ respuesta: 'Error en editar usuario', mensaje: error })
    }
}

export const deleteUser = async (req, res) => {
    const { id } = req.params

    try {
        const user = await userModel.findByIdAndDelete(id)
        if (user) {
            res.status(200).send({ respuesta: 'OK', mensaje: user })
        } else {
            res.status(404).send({ respuesta: 'Error', mensaje: 'Not Found' })
        }

    } catch (error) {
        res.status(400).send({ respuesta: 'Error en borrar usuario', mensaje: error })
    }
}

const recoveryLinks = {}

export const recoveryPassword = async (req, res) => {
    const { email } = req.body

    try {
        const token = crypto.randomBytes(20).toString('hex')
        recoveryLinks[token] = { email: email, timestamp: Date.now() }

        const recoveryLink = `http://localhost:5173/change-password/${token}`

        sendRecoveryMail(email, recoveryLink)

        res.status(200).send('Correo de recuperacion enviado')
    } catch (error) {
        res.status(500).send(`Error al enviar el mail ${error}`)
    }
}

export const resetPassword = async (req, res) => {
    const { token } = req.params
    const { newPassword, newPassword2 } = req.body
    console.log(newPassword, newPassword2)
    try {
        const linkData = recoveryLinks[token]
        console.log(linkData)
        if (linkData && Date.now() - linkData.timestamp <= 3600000) {
            const { email } = linkData
            if (newPassword == newPassword2) {
                const passwordHash = createHash(newPassword)
                console.log(passwordHash)
                delete recoveryLinks[token]
                
                await userModel.findOneAndUpdate({email: email}, { password: passwordHash })
                res.status(200).send('Contraseña modificada correctamente')
            } else {
                res.status(400).send('Las contraseñas no son iguales')
            }
        } else {
            res.status(400).send('Token expirado')
        }
    } catch (error) {
        res.status(500).send(`Error al reestablecer contraseña ${error}`)
    }
}


export const uploadFile = async (req, res) => {
    const { id } = req.params
    const files = req.files
    if (!files || files.length === 0) {
        return res.status(400).send({ respuesta: 'No se subieron archivos.' });
    }
    try {
        const user = await userModel.findById(id)
        if (!user) {
            return res.status(404).send({ respuesta: 'Usuario no encontrado.' });
        }
        const updatedDocuments = files.map(file => ({
            name: file.originalname,
            reference: file.path
        }))
        user.documents.push(...updatedDocuments);
        await user.save();

        res.status(200).send({ respuesta: 'Documentos subidos exitosamente.', documentos: user.documents });
    } catch (error) {
        console.error('Error al subir documentos:', error);
        res.status(500).send({ respuesta: 'Error al subir documentos' });
    }
}

export const deleteInactivity = async (req, res) => {
    const inactivity = new Date(new Date().setDate(new Date().getDate() - 2))

    const filter = { lastConnection: { $lt: inactivity } }

    try {
        const usersToDelete = await userModel.find(filter, 'email')

        const result = await userModel.deleteMany(filter)
        if (result.deletedCount > 0) {
            usersToDelete.forEach(user => {
                deletedUser(user.email)
            })
            res.status(200).send({respuesta: 'Usuarios eliminados correctamente', eliminados: result.deletedCount})
        }   else {
            res.status(404).send({ respuesta: 'No se encontraron usuarios para eliminar' });
        }

    } catch (error) {
        res.status(400).send({ respuesta: 'Error en borrar usuario', mensaje: error })
    }
}
