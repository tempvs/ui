import React from 'react';
import { Button, Col, Container, Form, Row } from 'react-bootstrap';
import { FaTimes } from 'react-icons/fa';

type Translator = (id: string, defaultMessage: string, values?: Record<string, unknown>) => string;

type CreateProfileFormProps = {
  firstName?: string;
  lastName?: string;
  nickName?: string;
  profileEmail?: string;
  location?: string;
  alias?: string;
  isErrorMessage?: boolean;
  t: Translator;
  onChange?: React.ChangeEventHandler<HTMLInputElement>;
  onSubmit?: React.FormEventHandler<HTMLFormElement>;
};

type IconProps = {
  className?: string;
  title?: string;
};

const ErrorIcon = FaTimes as React.ComponentType<IconProps>;

export default function CreateProfileForm({
  firstName,
  lastName,
  nickName,
  profileEmail,
  location,
  alias,
  isErrorMessage,
  t,
  onChange,
  onSubmit,
}: CreateProfileFormProps) {
  return (
    <Container>
      <Row>
        <Col sm={12}>
          <h2>{t('profile.create.title', 'Create your profile')}</h2>
          <p>{t('profile.create.subtitle', 'Your user profile does not exist yet. Complete the required fields to continue.')}</p>
        </Col>
      </Row>
      <Row>
        <Col sm={6}>
          <Form onSubmit={onSubmit}>
            <Form.Group controlId="firstName" className="mb-3">
              <Form.Label>{t('profile.field.firstName', 'First name')} *</Form.Label>
              <Form.Control name="firstName" type="text" required value={firstName} onChange={onChange} />
            </Form.Group>
            <Form.Group controlId="lastName" className="mb-3">
              <Form.Label>{t('profile.field.lastName', 'Last name')} *</Form.Label>
              <Form.Control name="lastName" type="text" required value={lastName} onChange={onChange} />
            </Form.Group>
            <Form.Group controlId="nickName" className="mb-3">
              <Form.Label>{t('profile.field.nickName', 'Nick name')}</Form.Label>
              <Form.Control name="nickName" type="text" value={nickName} onChange={onChange} />
            </Form.Group>
            <Form.Group controlId="profileEmail" className="mb-3">
              <Form.Label>{t('profile.field.email', 'Profile email')}</Form.Label>
              <Form.Control name="profileEmail" type="email" value={profileEmail} onChange={onChange} />
            </Form.Group>
            <Form.Group controlId="location" className="mb-3">
              <Form.Label>{t('profile.field.location', 'Location')}</Form.Label>
              <Form.Control name="location" type="text" value={location} onChange={onChange} />
            </Form.Group>
            <Form.Group controlId="alias" className="mb-3">
              <Form.Label>{t('profile.field.alias', 'Alias')}</Form.Label>
              <Form.Control name="alias" type="text" value={alias} onChange={onChange} />
            </Form.Group>
            <div className="d-flex align-items-center gap-2">
              <Button variant="secondary" type="submit">
                {t('profile.create.submit', 'Create profile')}
              </Button>
              {isErrorMessage && <ErrorIcon className="text-danger" title={t('profile.create.failedShort', 'Creation failed')} />}
            </div>
          </Form>
        </Col>
      </Row>
    </Container>
  );
}
