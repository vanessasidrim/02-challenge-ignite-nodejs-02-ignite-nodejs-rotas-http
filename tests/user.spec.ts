import { app } from '../src/app'
import { test, describe, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { execSync } from 'node:child_process'
import request from 'supertest'
import { fakerPT_BR as faker } from '@faker-js/faker'
import { knex } from '../src/database'

describe('Users route', () => {
  beforeAll(async () => {
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    execSync('npm run knex migrate:unlock')
    execSync('npm run knex migrate:rollback --all')
    execSync('npm run knex migrate:latest')
  })

  test('should be able to create a new user', async () => {
    const user = {
      name: faker.person.fullName(),
      email: faker.internet.email(),
    }

    const response = await request(app.server)
      .post('/user')
      .send({
        name: user.name,
        email: user.email,
      })
      .expect(201)

    const cookie = response.get('Set-Cookie')
    expect(cookie).toEqual(
      expect.arrayContaining([expect.stringContaining('sessionId')]),
    )

    expect(
      await knex('users').where({ name: user.name, email: user.email }).first(),
    ).toBeDefined()
  })

  test('should not be able to create two users with the same email', async () => {
    const email = faker.internet.email()

    await request(app.server)
      .post('/user')
      .send({
        name: faker.person.fullName(),
        email,
      })
      .expect(201)

    const response = await request(app.server)
      .post('/user')
      .send({
        name: faker.person.fullName(),
        email,
      })
      .expect(400)

    expect(response.body.message).toEqual('User already exists')
  })

  test('should not be able to create users with the name or email invalid', async () => {
    await request(app.server)
      .post('/user')
      .send({
        name: faker.number.int(),
        email: faker.number.int(),
      })
      .expect(500)
  })
})
