import { app } from '../src/app'
import { test, describe, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { execSync } from 'node:child_process'
import request, { Response } from 'supertest'
import { fakerPT_BR as faker } from '@faker-js/faker'
import { knex } from '../src/database'

let cookie: string
let responseUser: Response

describe('Meals route', () => {
  beforeAll(async () => {
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(async () => {
    execSync('npm run knex migrate:unlock')
    execSync('npm run knex migrate:rollback --all')
    execSync('npm run knex migrate:latest')

    const user = {
      name: faker.person.fullName(),
      email: faker.internet.email(),
    }

    responseUser = await request(app.server)
      .post('/user')
      .send({
        name: user.name,
        email: user.email,
      })
      .expect(201)

    cookie = responseUser.get('Set-Cookie')?.toString() || ''
  })

  test('should be able to create a new meal', async () => {
    const meal = {
      name: 'Dinner',
      description: `It's a delicious dish`,
      isOnDiet: faker.datatype.boolean(),
      date: new Date(),
    }

    await request(app.server)
      .post('/meal')
      .set('Cookie', cookie)
      .send({
        name: meal.name,
        description: meal.description,
        isOnDiet: meal.isOnDiet,
        date: meal.date,
      })
      .expect(201)

    const countMeals = await knex('meals')
      .where({
        name: meal.name,
        description: meal.description,
        is_on_diet: meal.isOnDiet,
        date: meal.date.getTime(),
      })
      .count('id', { as: 'total' })
      .first()

    expect(countMeals?.total).toEqual(1)
  })

  test('should not be able to create a meal with the data invalid', async () => {
    await request(app.server)
      .post('/meal')
      .set('Cookie', cookie)
      .send({
        name: faker.number.int(),
        descriprion: faker.number.int(),
        isOnDiet: faker.number.int(),
        date: faker.number.int(),
      })
      .expect(500)
  })

  test('should not be able to list meal with invalid user', async () => {
    const response = await request(app.server)
      .post('/meal')
      .set('Cookie', faker.string.uuid())
      .send({
        name: faker.number.int(),
        descriprion: faker.number.int(),
        isOnDiet: faker.number.int(),
        date: faker.number.int(),
      })
      .expect(401)

    expect(response.body.error).toEqual('Unauthorized')
  })

  test('should be able to show one meal', async () => {
    const meal = {
      name: 'Dinner',
      description: `It's a delicious dish`,
      isOnDiet: faker.datatype.boolean(),
      date: new Date(),
    }

    await request(app.server)
      .post('/meal')
      .set('Cookie', cookie)
      .send({
        name: meal.name,
        description: meal.description,
        isOnDiet: meal.isOnDiet,
        date: meal.date,
      })
      .expect(201)

    const mealsResponse = await request(app.server)
      .get('/meal')
      .set('Cookie', cookie)
      .expect(200)

    const mealId = mealsResponse.body.meals[0].id

    const mealResponse = await request(app.server)
      .get(`/meal/${mealId}`)
      .set('Cookie', cookie)
      .expect(200)

    expect(mealResponse.body).toEqual({
      meal: expect.objectContaining({
        name: meal.name,
        description: meal.description,
        is_on_diet: meal.isOnDiet === true ? 1 : 0,
        date: meal.date.getTime(),
      }),
    })
  })

  test('should not be able to show a inexisting meal ', async () => {
    await request(app.server)
      .get(`/meal/${faker.string.uuid()}`)
      .set('Cookie', cookie)
      .send({
        name: faker.number.int(),
        descriprion: faker.number.int(),
        isOnDiet: faker.number.int(),
        date: faker.number.int(),
      })
      .expect(404)
  })

  test('should not be able to create meal with invalid user', async () => {
    const meal = {
      name: 'Dinner',
      description: `It's a delicious dish`,
      isOnDiet: faker.datatype.boolean(),
      date: new Date(),
    }

    const response = await request(app.server)
      .post('/meal')
      .set('Cookie', faker.string.uuid())
      .send({
        name: meal.name,
        description: meal.description,
        isOnDiet: meal.isOnDiet,
        date: meal.date,
      })
      .expect(401)

    expect(response.body.error).toEqual('Unauthorized')
  })

  test('should be able to show meals ', async () => {
    const mealFirst = {
      name: 'Dinner',
      description: `It's a delicious dish`,
      isOnDiet: faker.datatype.boolean(),
      date: new Date(),
    }

    const mealSecond = {
      name: 'Lunch',
      description: `It's a delicious food`,
      isOnDiet: faker.datatype.boolean(),
      date: new Date(),
    }

    await request(app.server)
      .post('/meal')
      .set('Cookie', cookie)
      .send({
        name: mealFirst.name,
        description: mealFirst.description,
        isOnDiet: mealFirst.isOnDiet,
        date: mealFirst.date,
      })
      .expect(201)

    await request(app.server)
      .post('/meal')
      .set('Cookie', cookie)
      .send({
        name: mealSecond.name,
        description: mealSecond.description,
        isOnDiet: mealSecond.isOnDiet,
        date: mealSecond.date,
      })
      .expect(201)

    const mealsResponse = await request(app.server)
      .get('/meal')
      .set('Cookie', cookie)
      .expect(200)

    expect(mealsResponse.body.meals).toHaveLength(2)
    expect(mealsResponse.body.meals[0].name).toEqual(mealFirst.name)
    expect(mealsResponse.body.meals[0].description).toEqual(
      mealFirst.description,
    )
    expect(mealsResponse.body.meals[0].is_on_diet).toEqual(
      mealFirst.isOnDiet === true ? 1 : 0,
    )
    expect(mealsResponse.body.meals[0].date).toEqual(mealFirst.date.getTime())
    expect(mealsResponse.body.meals[1].name).toEqual(mealSecond.name)
    expect(mealsResponse.body.meals[1].description).toEqual(
      mealSecond.description,
    )
    expect(mealsResponse.body.meals[1].is_on_diet).toEqual(
      mealSecond.isOnDiet === true ? 1 : 0,
    )
    expect(mealsResponse.body.meals[1].date).toEqual(expect.any(Number))
  })

  test('should be able to update a meal', async () => {
    const mealBeforeUpdate = {
      name: 'Dinner',
      description: `It's a delicious dish`,
      isOnDiet: faker.datatype.boolean(),
      date: new Date(),
    }

    await request(app.server)
      .post('/meal')
      .set('Cookie', cookie)
      .send({
        name: mealBeforeUpdate.name,
        description: mealBeforeUpdate.description,
        isOnDiet: mealBeforeUpdate.isOnDiet,
        date: mealBeforeUpdate.date,
      })
      .expect(201)

    const mealsResponse = await request(app.server)
      .get('/meal')
      .set('Cookie', cookie)
      .expect(200)

    const mealId = mealsResponse.body.meals[0].id

    const mealAfterUpdate = {
      name: 'Lunch',
      description: `It's a delicious food`,
      isOnDiet: faker.datatype.boolean(),
      date: new Date(),
    }

    await request(app.server)
      .put(`/meal/${mealId}`)
      .set('Cookie', cookie)
      .send({
        name: mealAfterUpdate.name,
        description: mealAfterUpdate.description,
        isOnDiet: mealAfterUpdate.isOnDiet,
        date: mealAfterUpdate.date,
      })
      .expect(204)

    const totalMeals = await knex('meals')
      .where({
        name: mealAfterUpdate.name,
        description: mealAfterUpdate.description,
        is_on_diet: mealAfterUpdate.isOnDiet,
        date: mealAfterUpdate.date.getTime(),
      })
      .count('id', { as: 'total' })
      .first()

    expect(totalMeals?.total).toEqual(1)
  })

  test('should be able to delete a meal', async () => {
    const meal = {
      name: 'Dinner',
      description: `It's a delicious dish`,
      isOnDiet: faker.datatype.boolean(),
      date: new Date(),
    }

    await request(app.server)
      .post('/meal')
      .set('Cookie', cookie)
      .send({
        name: meal.name,
        description: meal.description,
        isOnDiet: meal.isOnDiet,
        date: meal.date,
      })
      .expect(201)

    const mealsResponse = await request(app.server)
      .get('/meal')
      .set('Cookie', cookie)
      .expect(200)

    const mealId = mealsResponse.body.meals[0].id

    await request(app.server)
      .delete(`/meal/${mealId}`)
      .set('Cookie', cookie)
      .expect(204)

    const countMeals = await knex('meals')
      .where({
        name: meal.name,
        description: meal.description,
        is_on_diet: meal.isOnDiet,
        date: meal.date.getTime(),
      })
      .count('id', { as: 'total' })
      .first()

    expect(countMeals?.total).toEqual(0)
  })

  test('should be able to get metrics from a user', async () => {
    const mealsIsOnDiet = [true, true, false, false]
    for (const isOnDiet of mealsIsOnDiet) {
      const meal = {
        name: 'Dinner',
        description: `It's a delicious dish`,
        isOnDiet,
        date: new Date('2024-07-02T08:00:00'),
      }
      await request(app.server)
        .post('/meal')
        .set('Cookie', cookie)
        .send({
          name: meal.name,
          description: meal.description,
          isOnDiet: meal.isOnDiet,
          date: meal.date,
        })
        .expect(201)
    }

    let currentCount = 0
    let maxCount = 0

    for (let i = 0; i < mealsIsOnDiet.length; i++) {
      if (mealsIsOnDiet[i] === true) {
        currentCount++
        if (currentCount > maxCount) {
          maxCount = currentCount
        }
      } else {
        currentCount = 0
      }
    }

    const metricsResponse = await request(app.server)
      .get('/meal/metrics')
      .set('Cookie', cookie)
      .expect(200)

    expect(metricsResponse.body).toEqual({
      totalMeals: mealsIsOnDiet.length,
      totalMealsOnDiet: mealsIsOnDiet.filter((item) => item === true).length,
      totalMealsOffDiet: mealsIsOnDiet.filter((item) => item === false).length,
      bestOnDietSequence: maxCount,
    })
  })
})
