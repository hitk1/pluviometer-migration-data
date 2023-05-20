import firebase from 'firebase-admin'
import firebaseCredentials from './firebase.json'

interface IUser {
    name: string
    id: string
    email: string
    created_at: firebase.firestore.Timestamp
    is_active: boolean,
    deleted_at: firebase.firestore.Timestamp | null
}

interface IPluviometer {
    id: string
    created_at: firebase.firestore.Timestamp,
    location: string
    name: string
    updated_at: firebase.firestore.Timestamp,
    user_id: string
}

interface IUserRecords {
    date: Date,
    amount: number
}

const loadUserData = async (): Promise<IUser> => {
    const emailToFind = 'doni.degini@gmail.com'
    let userToRetrive: IUser | null = null
    const userCollection = firebase.firestore().collection('users')

    const docs = await userCollection.listDocuments()

    await Promise.all(docs.map(async item => {
        const userRef = await item.get()
        const userData = userRef.data() as IUser

        if (userData.email === emailToFind)
            userToRetrive = userData

    }))

    if (!userToRetrive)
        throw new Error('User not found')


    return userToRetrive
}

const deleteUserData = async (userId: string) => {

    const recordsCollection = firebase.firestore().collection('records')

    const userRecords = await recordsCollection.where(
        'user_id',
        '==',
        userId
    ).get()

    for (const single of userRecords.docs)
        await single.ref.delete()

    console.log('records deleted')
}

const getCurrentDataFromUser = () => {
    interface IUser {
        email: string
        nome: string
        sobrenome: string
        uuid: string
    }

    interface IRecord {
        comentario: string
        data: string
        lastUpdate: string
        owner: string
        pluvID: string
        quantidade: number
    }

    const userToFind = 'vera.degini@gmail.com'
    let userToRetrive: IUser
    const fullFile = require('./current-database.json')

    // find user
    for (const [_key, value] of Object.entries<IUser>(fullFile["Usuarios"])) {
        if (value.email === userToFind)
            userToRetrive = value
    }

    // find data
    const recordKeys = Object.keys(fullFile["Registros"])
    const userRecordKey = recordKeys.find(item => item == userToRetrive.uuid)

    const records = fullFile["Registros"][userRecordKey!]
    const userRecords: IUserRecords[] = []

    for (const single of Object.values<IRecord>(records)) {
        const { data } = single
        const [year, month, day] = data.split('-')

        const formatedDate = new Date(
            Number(year),
            Number(month) - 1,
            Number(day),
            12,
            0,
            0
        )

        userRecords.push({
            date: formatedDate,
            amount: single.quantidade
        })
    }

    return userRecords
}

const loadUserPluviometer = async (userId: string) => {
    const userPluviometers: IPluviometer[] = []
    const pluviometerCollection = firebase.firestore().collection('pluviometers')

    const docs = await pluviometerCollection.listDocuments()

    await Promise.all(docs.map(async item => {
        const pluvRef = await item.get()
        const pluviometerData = pluvRef.data() as IPluviometer

        if (pluviometerData.user_id === userId)
            userPluviometers.push({
                ...pluviometerData,
                id: pluvRef.id,
            })
    }))

    return userPluviometers
}

const migrateData = async (userId: string, pluviometer: IPluviometer, placedRecords: IUserRecords[]) => {
    interface IRecord {
        amount: number
        created_at: firebase.firestore.Timestamp,
        local_id: string
        pluviometer_id: string
        updated_at: firebase.firestore.Timestamp
        user_id: string
    }

    const recordsCollection = firebase.firestore().collection('records')

    for (const single of placedRecords) {
        await recordsCollection.add({
            amount: single.amount,
            created_at: single.date as any,
            updated_at: single.date as any,
            local_id: '',
            pluviometer_id: pluviometer.id,
            user_id: userId

        } as IRecord)
    }
}

(async () => {
    try {
        firebase.initializeApp({
            credential: firebase.credential.cert(firebaseCredentials as any),
        })

        const { id: userId } = await loadUserData()
        const [pluviometer] = await loadUserPluviometer(userId)
        const placedRecords = getCurrentDataFromUser()

        await migrateData(
            userId,
            pluviometer,
            placedRecords
        )

        console.log('records migrated')

        process.exit(0)
    } catch (error) {
        console.log(`Global error: ${error.message}`)
    }
})()

