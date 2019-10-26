import * as Yup from 'yup';
import { parseISO, addMonths, isEqual } from 'date-fns';
import Student from '../models/Student';
import Registration from '../models/Registration';
import Plan from '../models/Plan';

import RegistrationMail from '../jobs/RegistrationMail';
import Queue from '../../lib/Queue';

class RegistrationController {
  async index(req, res) {
    const { page = 1 } = req.query;

    const registration = await Registration.findAll({
      attributes: [
        'id',
        'student_id',
        'plan_id',
        'start_date',
        'end_date',
        'price',
      ],
      limit: 20,
      offset: (page - 1) * 20,
      include: [
        {
          model: Plan,
          as: 'plan',
          attributes: ['title'],
        },
        {
          model: Student,
          as: 'student',
          attributes: ['name', 'email'],
        },
      ],
    });

    return res.json(registration);
  }

  async store(req, res) {
    const schema = Yup.object().shape({
      start_date: Yup.date().required(),
      plan_id: Yup.number().required(),
    });

    if (!(await schema.isValid(req.body))) {
      return res.status(400).json({ error: 'Validation Fails' });
    }

    const student = await Student.findByPk(req.params.student_id);

    if (!student) {
      return res.status(400).json({ error: 'Student not found' });
    }

    if (await Registration.findOne({ where: { student_id: student.id } })) {
      return res
        .status(400)
        .json({ error: 'Already exists a registration with this student' });
    }

    const { plan_id } = req.body;

    const plan = await Plan.findByPk(plan_id);

    if (!plan) {
      return res.status(400).json({ error: 'Plan not found' });
    }

    const { student_id } = req.params;
    const { start_date } = req.body;

    const finalMonth = addMonths(parseISO(start_date), plan.duration);
    const planPrice = plan.duration * plan.price;

    await Registration.create({
      student_id,
      start_date,
      end_date: finalMonth,
      plan_id,
      price: planPrice,
    });

    /** Email */
    await Queue.add(RegistrationMail.key, {
      student,
      plan,
      planPrice,
      finalMonth,
    });

    return res.json({
      student_id,
      plan_id,
      start_date,
      end_date: finalMonth,
      price: planPrice,
    });
  }

  async update(req, res) {
    const schema = Yup.object().shape({
      start_date: Yup.date(),
      plan_id: Yup.number(),
    });

    if (!(await schema.isValid(req.body))) {
      return res.status(400).json({ error: 'Validation Fails' });
    }

    const { regist_id } = req.params;

    const registration = await Registration.findByPk(regist_id);

    if (!registration) {
      return res.status(400).json({ error: 'Registration does not exist' });
    }

    const { plan_id } = req.body;

    const plan = await Plan.findByPk(plan_id);

    if (plan && !plan) {
      return res.status(400).json({ error: 'Plan dos not exist' });
    }

    const { start_date } = req.body;

    const compareDate = isEqual(parseISO(start_date), registration.start_date);

    if (compareDate) {
      return res.status(400).json({ error: 'Dates are the same' });
    }

    const finalMonth = addMonths(parseISO(start_date), plan.duration);
    const planPrice = plan.duration * plan.price;

    await registration.update({
      plan_id,
      start_date,
      end_date: finalMonth,
      price: planPrice,
    });

    return res.json({
      registration: {
        plan_id,
        start_date,
        end_date: finalMonth,
        price: planPrice,
      },
    });
  }

  async delete(req, res) {
    const { regist_id } = req.params;
    /**
     *  Implementar condicao caso nao exista o ID
     */

    const registration = await Registration.findByPk(regist_id);

    await registration.destroy();

    return res.send();
  }
}

export default new RegistrationController();
