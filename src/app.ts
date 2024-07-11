import fastify from 'fastify'
import cookie from '@fastify/cookie'
import { userRoutes } from './routes/user'
import { mealRoutes } from './routes/meal'

export const app = fastify()

app.register(cookie)

app.register(userRoutes, { prefix: 'user' })
app.register(mealRoutes, { prefix: 'meal' })
