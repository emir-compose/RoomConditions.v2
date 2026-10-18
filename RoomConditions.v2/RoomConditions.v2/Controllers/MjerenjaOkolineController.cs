using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RoomConditions.v2.Db;
using RoomConditions.v2.Dtos;
using RoomConditions.v2.Models;

namespace RoomConditions.v2.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class MjerenjaOkolineController(MyDbContext db) : ControllerBase
    {

        [HttpPost]
        public async Task<ActionResult<MjerenjeOkolineResponse>> Dodaj(
            MjerenjeOkolineRequest request)
        {
            var mjerenje = new MjerenjeOkoline
            {
                DeviceId = request.DeviceId,
                TemperaturaC = request.TemperaturaC,
                VlaznostZraka = request.VlaznostZraka,
                KlimaUkljucena = request.KlimaUkljucena,
                DatumVrijemePrijemaUtc = DateTime.UtcNow
            };

            db.MjerenjaOkoline.Add(mjerenje);

            await db.SaveChangesAsync();

            var response = ToResponse(mjerenje);

            return CreatedAtAction(
                nameof(GetById),
                new { id = mjerenje.Id },
                response
            );
        }

        [HttpGet]
        public async Task<ActionResult<List<MjerenjeOkolineResponse>>> GetAll(
            [FromQuery] int limit = 50)
        {
            limit = Math.Clamp(limit, 1, 200);

            var mjerenja = await db.MjerenjaOkoline
                .AsNoTracking()
                .OrderByDescending(x => x.DatumVrijemePrijemaUtc)
                .Take(limit)
                .ToListAsync();

            return Ok(mjerenja.Select(ToResponse).ToList());
        }

        [HttpGet("{id:int}")]
        public async Task<ActionResult<MjerenjeOkolineResponse>> GetById(
            int id)
        {
            var mjerenje = await db.MjerenjaOkoline
                .AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == id);

            if (mjerenje == null)
                return NotFound();

            return Ok(ToResponse(mjerenje));
        }

        [HttpGet("latest")]
        public async Task<ActionResult<MjerenjeOkolineResponse>> GetLatest()
        {
            var mjerenje = await db.MjerenjaOkoline
                .AsNoTracking()
                .OrderByDescending(x => x.DatumVrijemePrijemaUtc)
                .ThenByDescending(x => x.Id)
                .FirstOrDefaultAsync();

            if (mjerenje == null)
                return NotFound();

            return Ok(ToResponse(mjerenje));
        }

        private static MjerenjeOkolineResponse ToResponse(
            MjerenjeOkoline mjerenje)
        {
            return new MjerenjeOkolineResponse(
                mjerenje.Id,
                mjerenje.DeviceId,
                mjerenje.TemperaturaC,
                mjerenje.VlaznostZraka,
                mjerenje.DatumVrijemePrijemaUtc,
                mjerenje.KlimaUkljucena
            );
        }
    }
}


    
        
    