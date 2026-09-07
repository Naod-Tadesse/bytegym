import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app/app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const globalPrefix = 'api';
  app.setGlobalPrefix(globalPrefix);

  app.useGlobalPipes(
    new ValidationPipe({
      // Strip properties with no decorator instead of trusting the client.
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.enableCors({
    origin: (process.env.CORS_ORIGINS ?? 'http://localhost:4200').split(','),
    credentials: true,
  });

  const port = process.env.PORT || 3000;

  // Off in production unless asked for: the spec enumerates every route and
  // every permission name, which is a map of the authorisation model.
  const docsEnabled =
    process.env.SWAGGER_ENABLED === 'true' ||
    process.env.NODE_ENV !== 'production';

  if (docsEnabled) {
    const config = new DocumentBuilder()
      .setTitle('bytegym API')
      .setDescription(
        'Staff-facing gym management API. Every route lives under `/api`.\n\n' +
          'Sign in with `POST /api/auth/login`, then press **Authorize** and ' +
          'paste the `accessToken`. Routes are gated on named permissions — ' +
          'each one lists what it needs in its 403 response.',
      )
      .setVersion('0.0.1')
      // Unnamed, so it matches the bare @ApiBearerAuth() that @Permissions()
      // and @Authenticated() apply. Both default to the scheme name 'bearer';
      // rename one and the Authorize button silently stops applying.
      .addBearerAuth({
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        in: 'header',
        description:
          'The accessToken from /api/auth/login or /api/auth/refresh.',
      })
      .addTag('Auth', 'Sign in, token refresh, logout and the current user')
      .addTag('Staff', 'Staff accounts — the only people who can sign in')
      .addTag('Members', 'Gym members — the people who train here')
      .addTag(
        'Membership plans',
        'The products sold to members — duration and price',
      )
      .addTag(
        'Memberships',
        'Periods of cover sold to a member — what makes them active today',
      )
      .addTag(
        'Payments',
        'Money received — recorded, voided, and totalled for a shift',
      )
      .addTag(
        'Check-ins',
        'The door — who trained today, and who was refused or waved through',
      )
      .addTag('Branches', 'Gym locations')
      .addTag('Roles', 'Roles and their permission grants')
      .addTag('Permissions', 'The fixed permission catalogue, for role editing')
      .addTag('Health', 'Unauthenticated liveness endpoints')
      .build();

    // Built after setGlobalPrefix, so every documented path carries /api.
    const document = SwaggerModule.createDocument(app, config);

    SwaggerModule.setup('docs', app, document, {
      // -> UI at /api/docs, raw spec at /api/docs-json. Inside the prefix so a
      // reverse proxy forwarding /api picks the docs up with no extra rule.
      useGlobalPrefix: true,
      customSiteTitle: 'bytegym API docs',
      swaggerOptions: {
        // Survives a page reload, so the token is pasted once per session.
        persistAuthorization: true,
        tagsSorter: 'alpha',
        operationsSorter: 'alpha',
        docExpansion: 'list',
      },
    });

    Logger.log(`📚 API docs on http://localhost:${port}/${globalPrefix}/docs`);
  }

  // Lets DatabaseModule close the pg pool on SIGINT/SIGTERM.
  app.enableShutdownHooks();
  await app.listen(port);
  Logger.log(
    `🚀 Application is running on: http://localhost:${port}/${globalPrefix}`,
  );
}

bootstrap();
