const contactService = require('../services/contact.service');

class ContactController {
    async createContact(req, res) {
        try {
            const contact = await contactService.createContact(req.body, req.user.id);
            res.status(201).json({ status: 'success', data: { contact } });
        } catch (error) {
            res.status(400).json({ status: 'fail', message: error.message });
        }
    }

    async getAllContacts(req, res) {
        try {
            const contacts = await contactService.getAllContacts(req.user, req.query);
            res.status(200).json({ status: 'success', data: { contacts } });
        } catch (error) {
            res.status(400).json({ status: 'fail', message: error.message });
        }
    }

    async getContactById(req, res) {
        try {
            const contact = await contactService.getContactById(req.params.id, req.user);
            if (!contact) {
                return res.status(404).json({ status: 'fail', message: 'Contact not found' });
            }
            res.status(200).json({ status: 'success', data: { contact } });
        } catch (error) {
            const status = error.status || 400;
            res.status(status).json({ status: 'fail', message: error.message });
        }
    }

    async updateContact(req, res) {
        try {
            const contact = await contactService.updateContact(req.params.id, req.body, req.user);
            res.status(200).json({ status: 'success', data: { contact } });
        } catch (error) {
            const status = error.status || 400;
            res.status(status).json({ status: 'fail', message: error.message });
        }
    }

    async deleteContact(req, res) {
        try {
            await contactService.deleteContact(req.params.id, req.user);
            res.status(204).json({ status: 'success', data: null });
        } catch (error) {
            const status = error.status || 400;
            res.status(status).json({ status: 'fail', message: error.message });
        }
    }
}

module.exports = new ContactController();
