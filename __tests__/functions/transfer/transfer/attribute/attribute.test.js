/* eslint-disable import/no-unresolved */

import Attribute from '@functions/transfer/transfer/attribute';

import faker from 'faker';

describe('Attribute', () => {
  const key = faker.random.word();

  const value = faker.random.number();

  // const data = JSON.stringify({ [key]: value });

  const artifact = {
    ready: async () => true,
    attribute: async (_, requestedKey) => {
      if (requestedKey !== key) {
        throw new Error('TEST');
      }
      return value;
    },
  };

  const artifactName = faker.random.word();

  const artifacts = { [artifactName]: artifact };

  describe('#new', () => {
    const mapping = faker.random.word();

    it('should instantiate correctly', () => {
      const attribute = new Attribute(mapping, artifacts);
      expect(attribute.mapping).toEqual(mapping);
      expect(attribute.artifacts).toEqual(artifacts);
    });
  });

  describe('#type', () => {
    describe('when the mapping is a static value', () => {
      const mapping = faker.random.word();

      it('should return the correct value', () => {
        const attribute = new Attribute(mapping, artifacts);
        expect(attribute.type).toEqual('STATIC');
      });
    });

    describe('when the mapping is an object', () => {
      const mapping = {
        'Fn::GetParam': [artifactName, faker.system.fileName(), key],
      };

      it('should return the correct value', () => {
        const attribute = new Attribute(mapping, artifacts);
        expect(attribute.type).toEqual('REMOTE');
      });
    });
  });

  describe('#value', () => {
    describe('when the mapping is a static value', () => {
      const mapping = faker.random.word();

      it('should return the correct value', () => {
        const attribute = new Attribute(mapping, artifacts);
        return expect(attribute.value()).resolves.toEqual(mapping);
      });
    });

    describe('when the mapping is an object', () => {
      describe('when the mapping is an unrecognised key', () => {
        const mapping = {
          [faker.random.uuid()]: faker.random.words(),
        };

        it('should return the correct value', () => {
          const attribute = new Attribute(mapping, artifacts);
          return expect(attribute.value()).rejects.toEqual(expect.any(Error));
        });
      });

      describe('when the mapping contains an invalid key', () => {
        const mapping = {
          'Fn::GetParam': [artifactName, faker.system.fileName(), faker.random.uuid()],
        };

        it('should return the correct value', () => {
          const attribute = new Attribute(mapping, artifacts);
          return expect(attribute.value()).rejects.toEqual(expect.any(Error));
        });
      });

      describe('when the mapping contains an invalid artifact', () => {
        const mapping = {
          'Fn::GetParam': [faker.random.uuid(), faker.system.fileName(), key],
        };

        it('should return the correct value', () => {
          const attribute = new Attribute(mapping, artifacts);
          return expect(attribute.value()).rejects.toEqual(expect.any(Error));
        });
      });

      describe('when the mapping is valid', () => {
        const mapping = {
          'Fn::GetParam': [artifactName, faker.system.fileName(), key],
        };

        it('should return the correct value', () => {
          const attribute = new Attribute(mapping, artifacts);
          return expect(attribute.value()).resolves.toEqual(value);
        });
      });
    });
  });
});
